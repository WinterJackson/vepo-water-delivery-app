"""Image validation utilities for proof-of-delivery and uploads."""
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Accepted image extensions for proof-of-delivery photos
ACCEPTED_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png"}
CLOUDINARY_HOSTS = {"res.cloudinary.com"}


def validate_proof_url(url: str) -> bool:
    """Validate that a proof URL is a legitimate Cloudinary-hosted image.

    Args:
        url: The image URL to validate.

    Returns:
        True if valid, False otherwise.
    """
    if not url or not isinstance(url, str):
        return False

    try:
        parsed = urlparse(url)
    except Exception:
        return False

    # Must be HTTPS
    if parsed.scheme != "https":
        logger.warning(f"Proof URL rejected: non-HTTPS scheme '{parsed.scheme}'")
        return False

    # Must be from Cloudinary
    if parsed.hostname not in CLOUDINARY_HOSTS:
        logger.warning(f"Proof URL rejected: untrusted host '{parsed.hostname}'")
        return False

    # Must have an image extension
    path_lower = parsed.path.lower()
    if not any(path_lower.endswith(ext) for ext in ACCEPTED_EXTENSIONS):
        logger.warning(f"Proof URL rejected: unsupported extension in '{parsed.path}'")
        return False

    return True


def is_webp(url: str) -> bool:
    """Check if a URL points to a WebP image."""
    if not url:
        return False
    return urlparse(url).path.lower().endswith(".webp")
