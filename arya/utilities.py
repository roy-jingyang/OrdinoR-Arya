def get_file_extension(fn):
    return fn.rsplit('.', 1)[1].lower()


def random_id_hex64d():
    from random import randrange
    # generate ID taking the first 64 digits of a random Hex number
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
