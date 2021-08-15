from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed
import wtforms

class LogUploadForm(FlaskForm):
    f_log = FileField(
        u'Select an event log file with one of the extensions below',
        validators=[
            FileRequired(),
            FileAllowed(['xes'], 
                'Incompatible file extension. Please check again')
        ]
    )
    submit = wtforms.SubmitField(
        u'Upload'
    )


class RequiredIfOnlyEqualsTo:
    ''' A validator which makes a field required if another field is set
        and has a desired value, otherwise a None value is accepted.
        link: https://stackoverflow.com/a/8464478/3359917
        link: https://stackoverflow.com/a/25402311/3359917
    '''
    def __init__(self, 
        other_field_name, other_field_values, stop_validation=False,
        *args, **kwargs):
        self.dep_field_name = other_field_name
        self.dep_field_values = other_field_values
        self.stop_validation = stop_validation
        super(RequiredIfOnlyEqualsTo, self).__init__(*args, **kwargs)

    def __call__(self, form, field):
        dep_field = form._fields.get(self.dep_field_name)

        if dep_field is not None \
            and dep_field.data in self.dep_field_values:
            wtforms.validators.InputRequired.__call__(self, form, field)
        else:
            wtforms.validators.Optional.__call__(self, form, field)

        if self.stop_validation:
            raise wtforms.validators.StopValidation


from abc import ABC, abstractmethod
class MethodConfigForm(ABC):
    # Define an inner class 'form' inheriting flask_wtf.FlaskForm

    @classmethod
    def init_config(cls):
        from collections import defaultdict
        return defaultdict(lambda: {
            'method': None,
            'params': dict()
        })

    @classmethod
    @abstractmethod
    def parse_form(form):
        raise NotImplementedError


class DiscoveryConfigForm(MethodConfigForm):
    class Form(FlaskForm):
        # Phase 1 methods and options
        method_learn_exec_ctxs = wtforms.SelectField(
            u'Phase 1. Learn execution contexts',
            choices=[
                (None, '(select a method)'),
                ('ATonlyMiner', 'ATonly'),
                ('FullMiner', 'CT+AT+TT (case attribute)')
            ],
            validators=[wtforms.validators.InputRequired()],
            render_kw={
                'config_type': 'method',
                'config_id': 'learn_exec_ctxs',
            }
        ) 
        param_FullMiner_case_attr_name = wtforms.SelectField(
            u'''CT+AT+TT (case attribute): Select the field to be used as the
            case-level attributes for deciding case types''',
            # Dynamic choices
            choices=[],
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_learn_exec_ctxs',
                    ['FullMiner'],
                    stop_validation=True
                )
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'case_attr_name',
                'prerequisite_id': 'learn_exec_ctxs',
                'prerequisite_value': 'FullMiner',
            }
        )
        param_FullMiner_resolution = wtforms.SelectField(
            u'''CT+AT+TT (case attribute): Select the level of resolution for
            time types expected.''',
            choices=[
                ('hour', 'hour'),
                ('day', 'day'),
                ('weekday', 'weekday'),
                ('month', 'month')
            ],
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_learn_exec_ctxs',
                    ['FullMiner'],
                    stop_validation=True
                )
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'resolution',
                'prerequisite_id': 'learn_exec_ctxs',
                'prerequisite_value': 'FullMiner',
            }
        )

        # Phase 2 methods and options
        method_discover_res_groupings = wtforms.SelectField(
            u'Phase 2. Discover resource groupings',
            choices=[
                (None, '(select a method)'),
                ('ahc', 'AHC'),
                ('moc', 'MOC')
            ],
            validators=[wtforms.validators.InputRequired()],
            render_kw={
                'config_type': 'method',
                'config_id': 'discover_res_groupings',
            }
        )
        param_n_groups = wtforms.IntegerField(
            u'''Specify the number of resource groups expected''',
            # Dynamic number range need to specified
            # wtforms.validators.NumberRange(min, max)
            validators=[
                wtforms.validators.InputRequired()
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'n_groups',
                'prerequisite_id': 'discover_res_groupings',
                'prerequisite_value': 'ahc,moc',
            }
        )
        param_ahc_method = wtforms.SelectField(
            u'''AHC: Specify the method for merging clusters''',
            choices=[
                ('ward', "Ward's method"),
                ('single', 'Single linkage'),
                ('complete', 'Complete linkage')
            ],
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_discover_res_groupings',
                    ['ahc'],
                    stop_validation=True
                )
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'method',
                'prerequisite_id': 'discover_res_groupings',
                'prerequisite_value': 'ahc',
            }
        )
        param_moc_init = wtforms.SelectField(
            u'''MOC: Specify the method for initializing model parameters''',
            choices=[
                ('kmeans', 'KMeans clustering')
            ],
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_discover_res_groupings',
                    ['moc'],
                    stop_validation=True
                )
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'init',
                'prerequisite_id': 'discover_res_groupings',
                'prerequisite_value': 'moc',
            }
        )

        # Phase 3 methods and options
        method_assign_exec_ctxs = wtforms.SelectField(
            u'Phase 3. Profile resource groups',
            choices=[
                (None, '(select a method)'),
                ('full_recall', 'FullRecall'),
                ('overall_score', 'OverallScore')
            ],
            validators=[wtforms.validators.InputRequired()],
            render_kw={
                'config_type': 'method',
                'config_id': 'assign_exec_ctxs',
            }
        )
        param_overall_score_p = wtforms.FloatField(
            u'''OverallScore: p (threshold value for the overall
            score)''',
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_assign_exec_ctxs',
                    ['overall_score']
                ),
                wtforms.validators.NumberRange(0, 1.0),
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'p',
                'prerequisite_id': 'assign_exec_ctxs',
                'prerequisite_value': 'overall_score',
            }
        )
        param_overall_score_w1 = wtforms.FloatField(
            u'''OverallScore: w1 (weight value for Group Relative Stake)''',
            validators=[
                RequiredIfOnlyEqualsTo(
                    'method_assign_exec_ctxs',
                    ['overall_score']
                ),
                wtforms.validators.NumberRange(0, 1.0),
            ],
            render_kw={
                'config_type': 'param',
                'config_id': 'w1',
                'prerequisite_id': 'assign_exec_ctxs',
                'prerequisite_value': 'overall_score',
            }
        )

        submit = wtforms.SubmitField(
            u'Discover model'
        )

    @classmethod
    def parse_form(cls, form):
        config = cls.init_config()
        for name, value in form.data.items():
            field = form._fields.get(name)
            if field.render_kw is not None and value is not None:
                if field.render_kw['config_type'] == 'method':
                    phase = field.render_kw['config_id']
                    config[phase]['method'] = value
                elif field.render_kw['config_type'] == 'param':
                    phase = field.render_kw['prerequisite_id']
                    param_name = field.render_kw['config_id']
                    config[phase]['params'][param_name] = value
                else:
                    pass
        return config

