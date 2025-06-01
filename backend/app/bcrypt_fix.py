# app/bcrypt_fix.py
import logging

try:
    import bcrypt
    if not hasattr(bcrypt, '__about__'):
        class MockAbout:
            __version__ = getattr(bcrypt, '__version__', '3.2.0')
        bcrypt.__about__ = MockAbout()
        logging.info("Applied bcrypt compatibility patch")
except ImportError:
    logging.warning("bcrypt module not found. Please install it with 'pip install bcrypt'")