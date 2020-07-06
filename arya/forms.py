from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired

class RequiredIf(Required):
    ''' A validator which makes a field required if another field is set
        and has a truthy value.
        link: https://stackoverflow.com/a/8464478/3359917
    '''
    def __init__(self, other_field_name, *args, **kwargs):
        self.other_field_name = other_field_name
        super(RequiredIf, self).__init__(*args, **kwargs)

    def __call__(self, form, field):
        other_field = form._fields.get(self.other_field_name)
        if other_field is None:
            raise Exception('no field named "%s" in form' % self.other_field_name)
        if bool(other_field.data):
            super(RequiredIf, self).__call__(form, field)


class MyForm(FlaskForm):
    name = StringField('name', validators=[DataRequired()])

