from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed, FileRequired
from wtforms import SubmitField


class UploadForm(FlaskForm):
    file = FileField("Upload Excel File", validators=[FileRequired(), FileAllowed(["xlsx"], "Excel files only!")])
    submit = SubmitField("Upload")
