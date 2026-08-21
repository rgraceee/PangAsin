from flask_wtf import FlaskForm
from wtforms import TextAreaField, SubmitField
from wtforms.validators import DataRequired


class ValidationForm(FlaskForm):
    reviewer_comment = TextAreaField("Reviewer Comment", validators=[DataRequired()])
    approve = SubmitField("Approve")
    reject = SubmitField("Reject")
    return_btn = SubmitField("Return")
