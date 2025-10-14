import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import (
    create_engine, Integer, String, ForeignKey, Identity, func
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session
from sqlalchemy.exc import IntegrityError, NoResultFound
from dotenv import load_dotenv