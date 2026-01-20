"""FastAPI router for SSL Certificate Inspector."""

import hashlib
import socket
import ssl
from datetime import UTC, datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import APIRouter, HTTPException

from app.registry import tool_registry
from app.tools.ssl_inspector.metadata import TOOL_METADATA
from app.tools.ssl_inspector.models import (
    CertificateInfo,
    CertificateStatus,
    ChainInfo,
    ConnectionInfo,
    RunRequest,
    SslInspectorReport,
)

router = APIRouter()


def get_certificate_status(not_before: datetime, not_after: datetime) -> CertificateStatus:
    """Determine certificate status based on validity dates."""
    now = datetime.now(UTC)

    # Make dates timezone-aware if they aren't
    if not_before.tzinfo is None:
        not_before = not_before.replace(tzinfo=UTC)
    if not_after.tzinfo is None:
        not_after = not_after.replace(tzinfo=UTC)

    if now < not_before:
        return CertificateStatus.NOT_YET_VALID
    if now > not_after:
        return CertificateStatus.EXPIRED

    days_remaining = (not_after - now).days
    if days_remaining <= 30:
        return CertificateStatus.EXPIRING_SOON

    return CertificateStatus.VALID


def parse_certificate(cert: x509.Certificate) -> CertificateInfo:
    """Parse a certificate into CertificateInfo."""
    info = CertificateInfo()

    # Subject
    for attr in cert.subject:
        name = attr.oid._name
        info.subject[name] = attr.value

    # Issuer
    for attr in cert.issuer:
        name = attr.oid._name
        info.issuer[name] = attr.value

    # Serial number
    info.serial_number = format(cert.serial_number, "X")

    # Version
    info.version = cert.version.value + 1  # X.509 version is 0-indexed

    # Validity
    info.not_before = cert.not_valid_before_utc
    info.not_after = cert.not_valid_after_utc

    # Days until expiry
    now = datetime.now(UTC)
    info.days_until_expiry = (cert.not_valid_after_utc - now).days

    # Status
    info.status = get_certificate_status(cert.not_valid_before_utc, cert.not_valid_after_utc)

    # Subject Alternative Names
    try:
        san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        for name in san_ext.value:
            if isinstance(name, x509.DNSName):
                info.subject_alt_names.append(f"DNS:{name.value}")
            elif isinstance(name, x509.IPAddress):
                info.subject_alt_names.append(f"IP:{name.value}")
    except x509.ExtensionNotFound:
        pass

    # Key info
    public_key = cert.public_key()
    if isinstance(public_key, rsa.RSAPublicKey):
        info.key_type = "RSA"
        info.key_bits = public_key.key_size
    elif isinstance(public_key, ec.EllipticCurvePublicKey):
        info.key_type = "EC"
        info.key_bits = public_key.curve.key_size

    # Signature algorithm
    info.signature_algorithm = cert.signature_algorithm_oid._name

    # Fingerprints
    cert_der = cert.public_bytes(serialization.Encoding.DER)
    info.fingerprint_sha256 = hashlib.sha256(cert_der).hexdigest().upper()
    info.fingerprint_sha1 = hashlib.sha1(cert_der).hexdigest().upper()

    # Is self-signed?
    info.is_self_signed = cert.subject == cert.issuer

    # Is CA?
    try:
        bc_ext = cert.extensions.get_extension_for_class(x509.BasicConstraints)
        info.is_ca = bc_ext.value.ca
    except x509.ExtensionNotFound:
        info.is_ca = False

    return info


def analyze_chain(certs: list[x509.Certificate]) -> ChainInfo:
    """Analyze the certificate chain."""
    chain = ChainInfo()
    chain.certificates = [parse_certificate(cert) for cert in certs]

    if not certs:
        chain.issues.append("No certificates in chain")
        return chain

    # Check chain validity
    chain.chain_valid = True
    for i, cert_info in enumerate(chain.certificates):
        if cert_info.status == CertificateStatus.EXPIRED:
            chain.issues.append(f"Certificate {i + 1} has expired")
            chain.chain_valid = False
        elif cert_info.status == CertificateStatus.NOT_YET_VALID:
            chain.issues.append(f"Certificate {i + 1} is not yet valid")
            chain.chain_valid = False
        elif cert_info.status == CertificateStatus.EXPIRING_SOON:
            chain.issues.append(
                f"Certificate {i + 1} expires in {cert_info.days_until_expiry} days"
            )

    # Check if chain is complete (ends with self-signed root)
    if chain.certificates:
        last_cert = chain.certificates[-1]
        chain.chain_complete = last_cert.is_self_signed

        if not chain.chain_complete:
            chain.issues.append("Chain does not end with a root CA certificate")

    # Check key sizes
    for i, cert_info in enumerate(chain.certificates):
        if cert_info.key_type == "RSA" and cert_info.key_bits and cert_info.key_bits < 2048:
            chain.issues.append(
                f"Certificate {i + 1} uses weak RSA key ({cert_info.key_bits} bits)"
            )

    return chain


@router.post("/run", response_model=SslInspectorReport)
async def run_inspection(request: RunRequest) -> SslInspectorReport:
    """
    Inspect SSL/TLS certificate for a hostname.

    Retrieves certificate chain and analyzes validity, expiry, and security.
    """
    report = SslInspectorReport(
        hostname=request.hostname,
        port=request.port,
        queried_at=datetime.now(UTC),
    )

    try:
        # Create SSL context
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE  # We want to inspect even invalid certs

        # Connect and get certificate
        with socket.create_connection(
            (request.hostname, request.port), timeout=10
        ) as sock:
            with context.wrap_socket(sock, server_hostname=request.hostname) as ssock:
                # Connection info
                report.connection = ConnectionInfo(
                    protocol_version=ssock.version(),
                    cipher_suite=ssock.cipher()[0] if ssock.cipher() else None,
                    cipher_bits=ssock.cipher()[2] if ssock.cipher() else None,
                    server_hostname=request.hostname,
                )

                # Get certificate chain
                cert_der = ssock.getpeercert(binary_form=True)
                if cert_der:
                    cert = x509.load_der_x509_certificate(cert_der)
                    report.certificate = parse_certificate(cert)

                    # Try to get full chain
                    certs = [cert]
                    # Note: Python's ssl module doesn't easily expose the full chain
                    # In a production system, you'd use pyOpenSSL or similar
                    report.chain = analyze_chain(certs)

    except socket.timeout:
        report.errors.append("Connection timed out")
    except socket.gaierror as e:
        report.errors.append(f"DNS resolution failed: {e}")
    except ConnectionRefusedError:
        report.errors.append(f"Connection refused on port {request.port}")
    except ssl.SSLError as e:
        report.errors.append(f"SSL error: {e}")
    except Exception as e:
        report.errors.append(f"Error: {e}")

    return report


# Register tool
tool_registry.register(TOOL_METADATA, router)
