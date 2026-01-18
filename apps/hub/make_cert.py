# make_cert.py
# Tạo self-signed TLS certificate cho HUB (KHÔNG CẦN openssl)
# Output:
#   ./cert/server.key
#   ./cert/server.crt
#
# Requirements:
#   pip install cryptography

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def write_file(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cert_dir = os.path.join(base_dir, "cert")
    ensure_dir(cert_dir)

    key_path = os.path.join(cert_dir, "server.key")
    crt_path = os.path.join(cert_dir, "server.crt")

    # Generate RSA private key
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Subject/Issuer (self-signed)
    subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "HCM"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Ho Chi Minh City"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Chatbox HUB"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ]
    )
    issuer = subject

    now = datetime.now(timezone.utc)
    not_before = now - timedelta(minutes=5)
    not_after = now + timedelta(days=365)

    # ✅ SAN: localhost + 127.0.0.1 + hub (docker service)
    san = x509.SubjectAlternativeName(
        [
            x509.DNSName("localhost"),
            x509.DNSName("hub"),
            x509.DNSName("127.0.0.1"),
        ]
    )

    cert_builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(not_after)
        .add_extension(san, critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=True,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]),
            critical=False,
        )
    )

    cert = cert_builder.sign(private_key=key, algorithm=hashes.SHA256())

    # Write key + cert
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)

    write_file(key_path, key_pem)
    write_file(crt_path, cert_pem)

    print("✅ Generated HUB TLS cert successfully:")
    print(f"  - {key_path}")
    print(f"  - {crt_path}")
    print("\nℹ️ Self-signed cert: trình duyệt sẽ cảnh báo lần đầu, nhưng HTTPS/WSS chạy OK.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)
