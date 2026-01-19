"""DNSSEC validation collector."""

import dns.asyncresolver
import dns.dnssec
import dns.exception
import dns.flags
import dns.rdatatype
import dns.resolver

from app.tools.domain_interrogator.collectors.base import BaseCollector
from app.tools.domain_interrogator.models import DnssecInfo


class DnssecCollector(BaseCollector[DnssecInfo]):
    """Collects DNSSEC validation information."""

    name = "dnssec"
    default_timeout = 5.0

    async def collect(self) -> DnssecInfo:
        """Collect DNSSEC information."""
        info = DnssecInfo()

        resolver = dns.asyncresolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 3.0
        resolver.use_edns(edns=0, ednsflags=dns.flags.DO)  # Request DNSSEC records

        # Check for DS records at parent zone
        ds_records = await self._get_ds_records(resolver)
        info.ds_records = ds_records

        # Check for DNSKEY records
        dnskey_records = await self._get_dnskey_records(resolver)
        info.dnskey_records = dnskey_records

        # Check for RRSIG records (indicates signed zone)
        has_rrsig = await self._check_rrsig(resolver)
        info.has_rrsig = has_rrsig

        # Determine if DNSSEC is enabled
        info.enabled = bool(ds_records) or bool(dnskey_records)

        # Validate DNSSEC if enabled
        if info.enabled:
            valid, error = await self._validate_dnssec(resolver)
            info.valid = valid
            if error:
                info.error = error

        return info

    async def _get_ds_records(self, resolver: dns.asyncresolver.Resolver) -> list[str]:
        """Get DS records from parent zone."""
        ds_records = []
        try:
            answer = await resolver.resolve(self.domain, "DS")
            for rdata in answer:
                # Format: key_tag algorithm digest_type digest
                ds_records.append(
                    f"{rdata.key_tag} {rdata.algorithm} {rdata.digest_type} {rdata.digest.hex()}"
                )
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass
        return ds_records

    async def _get_dnskey_records(self, resolver: dns.asyncresolver.Resolver) -> list[str]:
        """Get DNSKEY records."""
        dnskey_records = []
        try:
            answer = await resolver.resolve(self.domain, "DNSKEY")
            for rdata in answer:
                # Identify KSK (flag 257) vs ZSK (flag 256)
                key_type = "KSK" if rdata.flags == 257 else "ZSK"
                dnskey_records.append(
                    f"{key_type} (flags={rdata.flags}, alg={rdata.algorithm}, "
                    f"key_tag={dns.dnssec.key_id(rdata)})"
                )
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass
        return dnskey_records

    async def _check_rrsig(self, resolver: dns.asyncresolver.Resolver) -> bool:
        """Check if the zone has RRSIG records."""
        try:
            answer = await resolver.resolve(self.domain, "A")
            # Check if RRSIG was returned with the answer
            response = answer.response
            if response:
                for rrset in response.answer:
                    if rrset.rdtype == dns.rdatatype.RRSIG:
                        return True
                # Also check authority section
                for rrset in response.authority:
                    if rrset.rdtype == dns.rdatatype.RRSIG:
                        return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            pass
        except dns.exception.DNSException:
            pass
        return False

    async def _validate_dnssec(
        self, resolver: dns.asyncresolver.Resolver
    ) -> tuple[bool, str | None]:
        """
        Validate DNSSEC chain.

        Returns (is_valid, error_message).
        """
        try:
            # Get DNSKEY records
            dnskey_answer = await resolver.resolve(self.domain, "DNSKEY")
            dnskeys = set(dnskey_answer)

            # Get DS records
            try:
                ds_answer = await resolver.resolve(self.domain, "DS")
                ds_records = set(ds_answer)

                # Validate DS records match DNSKEY
                for ds in ds_records:
                    for dnskey in dnskeys:
                        if dnskey.flags == 257:  # KSK
                            try:
                                computed_ds = dns.dnssec.make_ds(
                                    dns.name.from_text(self.domain),
                                    dnskey,
                                    ds.digest_type
                                )
                                if computed_ds == ds:
                                    return True, None
                            except Exception:
                                continue

                return False, "DS records do not match any DNSKEY"

            except dns.resolver.NoAnswer:
                # No DS records but has DNSKEY - might be unsigned parent
                return False, "No DS records found at parent zone"

        except dns.resolver.NoAnswer:
            return False, "No DNSKEY records found"
        except dns.exception.DNSException as e:
            return False, f"DNSSEC validation error: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
