from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SelectField, SubmitField
from wtforms.validators import DataRequired, Email, Length, Optional as WTFormsOptional
from app.models.municipality import Municipality


class UserForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=120)])
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=120)])
    password = PasswordField("Password", validators=[WTFormsOptional(), Length(min=6)])
    role = SelectField("Role", choices=[("encoder", "Encoder"), ("admin", "Administrator")], validators=[DataRequired()])
    municipality_id = SelectField("Municipality", coerce=int, validators=[WTFormsOptional()])
    status = SelectField("Status", choices=[("active", "Active"), ("inactive", "Inactive")], validators=[DataRequired()])
    submit = SubmitField("Save")

    def __init__(self, *args, **kwargs):
        super(UserForm, self).__init__(*args, **kwargs)
        self.municipality_id.choices = [(m.id, m.name) for m in Municipality.query.order_by(Municipality.name).all()]
        self.municipality_id.choices.insert(0, (0, "-- Select Municipality --"))
