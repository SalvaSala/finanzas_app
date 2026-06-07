"""Domain-level exceptions raised by the services layer.

The API maps these to HTTP responses (see ``app/main.py``), keeping the services
free of any FastAPI/HTTP coupling.
"""


class ServiceError(Exception):
    """Base class for service-layer errors."""


class NotFoundError(ServiceError):
    """A referenced entity does not exist."""


class ValidationError(ServiceError):
    """The requested operation violates a business rule."""
