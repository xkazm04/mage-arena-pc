"""Recompile current immutable A6 data without spending or rewriting history."""
from common import ART, write
from waves import brief, spec_for


def compile_spec():
    b=brief('A6')
    for item in b['items']:
        write(ART/'compiled/A6'/(item['id']+'.json'),spec_for('A6',item,b))
    return b


if __name__=='__main__': compile_spec()
