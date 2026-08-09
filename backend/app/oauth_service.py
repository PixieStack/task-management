import time
from typing import Any

import httpx
from jose import JWTError, jwt

from app.config import APPLE_CLIENT_ID, GOOGLE_CLIENT_ID

_JWKS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_JWKS_TTL_SECONDS = 3600

PROVIDERS = {
    "google": {
        "client_id": lambda: GOOGLE_CLIENT_ID,
        "jwks_url": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": {"https://accounts.google.com", "accounts.google.com"},
        "algorithms": ["RS256"],
    },
    "apple": {
        "client_id": lambda: APPLE_CLIENT_ID,
        "jwks_url": "https://appleid.apple.com/auth/keys",
        "issuers": {"https://appleid.apple.com"},
        "algorithms": ["RS256"],
    },
}


def _jwks(url: str) -> dict[str, Any]:
    cached = _JWKS_CACHE.get(url)
    now = time.time()
    if cached and now - cached[0] < _JWKS_TTL_SECONDS:
        return cached[1]
    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict) or not isinstance(data.get("keys"), list):
        raise ValueError("OAuth provider returned an invalid signing-key response")
    _JWKS_CACHE[url] = (now, data)
    return data


def verify_provider_id_token(provider: str, credential: str) -> dict[str, Any]:
    settings = PROVIDERS.get(provider)
    if not settings:
        raise ValueError("Unsupported OAuth provider")

    client_id = settings["client_id"]()
    if not client_id:
        raise RuntimeError(f"{provider.title()} sign-in is not configured")

    try:
        header = jwt.get_unverified_header(credential)
    except JWTError as exc:
        raise ValueError("Invalid provider credential") from exc

    kid = header.get("kid")
    if not kid:
        raise ValueError("Provider credential is missing its key identifier")

    key = next((item for item in _jwks(settings["jwks_url"])["keys"] if item.get("kid") == kid), None)
    if not key:
        # Refresh once in case the provider rotated signing keys.
        _JWKS_CACHE.pop(settings["jwks_url"], None)
        key = next((item for item in _jwks(settings["jwks_url"])["keys"] if item.get("kid") == kid), None)
    if not key:
        raise ValueError("Provider signing key was not found")

    try:
        claims = jwt.decode(
            credential,
            key,
            algorithms=settings["algorithms"],
            audience=client_id,
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise ValueError("Provider credential could not be verified") from exc

    if claims.get("iss") not in settings["issuers"]:
        raise ValueError("Provider credential issuer is invalid")
    if not claims.get("sub"):
        raise ValueError("Provider credential does not identify a user")

    return claims


def claim_is_true(value: Any) -> bool:
    return value is True or (isinstance(value, str) and value.lower() == "true")
