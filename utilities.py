def is_uploaded_file_allowed(fn_event_log):
    ALLOWED_EXT = {'csv', 'xes'}
    file_ext = '.' in fn_event_log and fn_event_log.rsplit('.', 1)[1].lower()
    if file_ext in ALLOWED_EXT:
        return file_ext
    else:
        return False


def create_user_id():
    from random import randrange
    return '{:x}'.format(randrange(10**32))[:64]


def _import_block(path_invoke):
    from importlib import import_module
    module = import_module('.'.join(path_invoke.split('.')[:-1]))
    foo = getattr(module, path_invoke.split('.')[-1])
    return foo


def _trim_activity_label_tail(s, patt):
    from re import search as regex_search
    match = regex_search(patt, s)
    return s[:match.start()]
