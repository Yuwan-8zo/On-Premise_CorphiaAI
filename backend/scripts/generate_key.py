import secrets
import string

def generate_secret_key(length=32) -> str:
    """Generate a high-entropy secret key for JWT signing."""
    alphabet = string.ascii_letters + string.digits
    # Generate random string and encode to hex for easier copy/pasting in .env
    key = secrets.token_hex(length)
    return key

if __name__ == "__main__":
    print("-" * 50)
    print("🔐 Corphia AI Secure Key Generator")
    print("-" * 50)
    
    new_key = generate_secret_key()
    
    print("\nCopy the following key and place it in your .env file:")
    print(f"\nSECRET_KEY=\"{new_key}\"\n")
    print("Example usage in your .env file:")
    print("APP_ENV=\"production\"")
    print(f"SECRET_KEY=\"{new_key}\"")
    print("\n" + "-" * 50)
