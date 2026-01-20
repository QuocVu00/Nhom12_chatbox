from pathlib import Path
from datetime import datetime, timedelta

# Cần thư viện cryptography
# cài: pip install cryptography

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

BASE = Path(__file__).resolve().parent
CERT_DIR = BASE / "cert"
CERT_DIR.mkdir(parents=True, exist_ok=True)

CRT_PATH = CERT_DIR / "server.crt"
KEY_PATH = CERT_DIR / "server.key"

def main():
    # Generate private key
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "HCM"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "HCMC"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "NetProg"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow() - timedelta(days=1))
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost")]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    # Write key
    KEY_PATH.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )

    # Write cert
    CRT_PATH.write_bytes(
        cert.public_bytes(serialization.Encoding.PEM)
    )

    print("✅ Generated:")
    print(" -", CRT_PATH)
    print(" -", KEY_PATH)

if __name__ == "__main__":
    main()
