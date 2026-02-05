"""
Exception handling utilities for the API.

This module provides consistent exception handling patterns and
specific exception types for different error scenarios.
"""
from typing import Optional, Any
from flask import jsonify
from sqlalchemy.exc import IntegrityError, DatabaseError
from marshmallow import ValidationError as MarshmallowValidationError
import requests


class APIException(Exception):
    """Base exception for API errors."""
    
    def __init__(self, message: str, status_code: int = 400, details: Optional[Any] = None):
        """
        Initialize API exception.
        
        Args:
            message: Error message
            status_code: HTTP status code
            details: Optional additional details
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details
    
    def to_dict(self):
        """Convert exception to dictionary for JSON response."""
        result = {"error": self.message}
        if self.details is not None:
            result["details"] = self.details
        return result


class ResourceNotFoundError(APIException):
    """Exception for when a requested resource is not found."""
    
    def __init__(self, resource_type: str, resource_id: Any):
        """
        Initialize resource not found error.
        
        Args:
            resource_type: Type of resource (e.g., "Order", "Product")
            resource_id: ID of the resource that was not found
        """
        message = f"{resource_type} with id {resource_id} not found"
        super().__init__(message, status_code=404)
        self.resource_type = resource_type
        self.resource_id = resource_id


class DuplicateResourceError(APIException):
    """Exception for when a resource already exists."""
    
    def __init__(self, resource_type: str, field: str, value: Any):
        """
        Initialize duplicate resource error.
        
        Args:
            resource_type: Type of resource
            field: Field that has the duplicate value
            value: The duplicate value
        """
        message = f"{resource_type} with {field} '{value}' already exists"
        super().__init__(message, status_code=409)


class InvalidInputError(APIException):
    """Exception for invalid input data."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        """
        Initialize invalid input error.
        
        Args:
            message: Error message
            field: Optional field name that has invalid data
        """
        super().__init__(message, status_code=400)
        self.field = field


class ExternalServiceError(APIException):
    """Exception for errors from external services (e.g., QuickBooks)."""
    
    def __init__(self, service_name: str, message: str, details: Optional[Any] = None):
        """
        Initialize external service error.
        
        Args:
            service_name: Name of the external service
            message: Error message
            details: Optional additional details
        """
        full_message = f"{service_name} error: {message}"
        super().__init__(full_message, status_code=502, details=details)
        self.service_name = service_name


def handle_database_error(error: Exception, operation: str = "database operation") -> tuple:
    """
    Handle database errors and return appropriate JSON response.
    
    Args:
        error: The database error that occurred
        operation: Description of the operation that failed
    
    Returns:
        Tuple of (json_response, status_code)
    """
    if isinstance(error, IntegrityError):
        # Database constraint violation (e.g., unique constraint, foreign key)
        return jsonify({
            "error": f"Database constraint violation during {operation}",
            "details": "A required database constraint was violated"
        }), 409
    
    elif isinstance(error, DatabaseError):
        # General database error
        return jsonify({
            "error": f"Database error during {operation}",
            "details": "An unexpected database error occurred"
        }), 500
    
    else:
        # Unknown error
        return jsonify({
            "error": f"Unexpected error during {operation}",
            "details": str(error)
        }), 500


def handle_validation_error(error: Exception) -> tuple:
    """
    Handle validation errors from Marshmallow or custom validation.
    
    Args:
        error: The validation error that occurred
    
    Returns:
        Tuple of (json_response, status_code)
    """
    if isinstance(error, MarshmallowValidationError):
        return jsonify({"error": "Validation failed", "details": error.messages}), 400
    
    elif hasattr(error, 'message'):
        return jsonify({"error": str(error.message)}), 400
    
    else:
        return jsonify({"error": str(error)}), 400


def handle_external_service_error(error: Exception, service_name: str = "external service") -> tuple:
    """
    Handle errors from external services (e.g., QuickBooks API).
    
    Args:
        error: The error that occurred
        service_name: Name of the external service
    
    Returns:
        Tuple of (json_response, status_code)
    """
    if isinstance(error, requests.exceptions.ConnectionError):
        return jsonify({
            "error": f"Failed to connect to {service_name}",
            "details": "Connection refused. Is the service running?"
        }), 502
    
    elif isinstance(error, requests.exceptions.Timeout):
        return jsonify({
            "error": f"{service_name} request timed out",
            "details": "The request took too long to complete"
        }), 504
    
    elif isinstance(error, requests.exceptions.RequestException):
        return jsonify({
            "error": f"{service_name} request failed",
            "details": str(error)
        }), 502
    
    else:
        return jsonify({
            "error": f"{service_name} error",
            "details": str(error)
        }), 502


def safe_commit(db, operation: str = "operation"):
    """
    Safely commit database changes with error handling.
    
    Args:
        db: Database session
        operation: Description of the operation (for error messages)
    
    Raises:
        APIException: If commit fails
    """
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise APIException(
            f"Database constraint violation during {operation}",
            status_code=409,
            details=str(e.orig) if hasattr(e, 'orig') else None
        )
    except DatabaseError as e:
        db.rollback()
        raise APIException(
            f"Database error during {operation}",
            status_code=500,
            details=str(e.orig) if hasattr(e, 'orig') else None
        )
    except Exception as e:
        db.rollback()
        raise APIException(
            f"Unexpected error during {operation}",
            status_code=500,
            details=str(e)
        )
