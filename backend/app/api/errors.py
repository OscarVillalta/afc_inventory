from werkzeug.http import HTTP_STATUS_CODES
from werkzeug.exceptions import HTTPException
from app.api import bp

def error_response(status_code, message=None):
    paylod = {'error':HTTP_STATUS_CODES.get(status_code, 'Unknown error')}
    if message:
        paylod['message'] = message
    return paylod, status_code


def bad_request(message):
    error_response(400, message)
    pass

@bp.errorhandler(HTTPException)
def handle_exception(e):
    return error_response(e.code)