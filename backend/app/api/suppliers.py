from app.api import bp
from app.api import base_route

@bp.route('/suppliers', methods=['GET'])
def get_suppliers():
    pass

@bp.route('/suppliers/<int:id>', methods=['GET'])
def get_supplier(id):
    pass

@bp.route('/suppliers', methods=['POST'])
def create_supplier():
    pass    

@bp.route('/suppliers/<int:id>', methods=['PUT'])
def update_supplier(id):
    pass