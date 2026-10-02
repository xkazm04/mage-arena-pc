"""Deterministic file/provenance gates, kept separate from semantic judgments."""
from pathlib import Path
from PIL import Image, ImageStat
from common import ART, ROOT, config, digest, get_style, input_matches_current, input_record, read, sha, source_path, write


def pixel_gate(path, expected_hash=None):
    cfg = config()
    codes = []
    metrics = {}
    try:
        path = Path(path)
        if expected_hash and sha(path) != expected_hash:
            codes.append('HASH_MISMATCH')
        with Image.open(path) as im:
            im.load()
            width, height = im.size
            metrics = {'width': width, 'height': height, 'format': im.format,
                       'aspect': width / height, 'luminance_stddev': ImageStat.Stat(im.convert('L')).stddev[0]}
            ratio_w, ratio_h = map(int, cfg['aspect_ratio'].split(':'))
            if width < cfg['minimum_width'] or height < cfg['minimum_height']:
                codes.append('TOO_SMALL')
            if abs(width / height - ratio_w / ratio_h) > cfg['aspect_tolerance']:
                codes.append('WRONG_ASPECT')
            if metrics['luminance_stddev'] < cfg['minimum_luminance_stddev']:
                codes.append('BLANK_OR_NEAR_BLANK')
            if im.convert('RGBA').getchannel('A').getextrema()[0] < 255:
                codes.append('UNEXPECTED_TRANSPARENCY')
    except Exception as exc:
        codes.append('UNREADABLE_IMAGE')
        metrics['error'] = str(exc)
    return {'verdict': 'reject' if codes else 'technical-pass', 'codes': codes, 'metrics': metrics,
            'scope': 'file, dimensions, aspect, alpha, contrast and hash only; semantics and taste not measured here'}


def check_job(job):
    if job['status'] != 'generated':
        return {'verdict': 'reject', 'codes': ['NOT_GENERATED'], 'metrics': {}}
    result = pixel_gate(source_path(job), job['sha256'])
    if not job.get('prompt_verbatim_verified'):
        result['codes'].append('PROMPT_NOT_VERIFIED')
    if not input_matches_current(job):
        result['codes'].append('STALE_BRIEF')
    if len(job.get('tool_calls', [])) != 1 or job['tool_calls'][0]['name'] != 'image_gen':
        result['codes'].append('TOOL_CONTRACT')
    else:
        actual = job['tool_calls'][0]['arguments']
        if actual.get('prompt') != job['prompt'] or actual.get('aspect_ratio') != job['input']['aspect_ratio']:
            result['codes'].append('ACTUAL_TOOL_INPUT_MISMATCH')
    expected_prompt = job['input']['prompt']
    if job.get('correction'):
        expected_prompt += '\n\nCORRECTION FROM DIRECT PIXEL REVIEW: ' + job['correction'].strip()
    if job['prompt'] != expected_prompt:
        result['codes'].append('UNRECORDED_PROMPT_CHANGE')
    if result['codes']:
        result['verdict'] = 'reject'
    return result


def review_proof(job, note):
    result = check_job(job)
    if job['scene'] != 'arena' or result['verdict'] != 'technical-pass' or not note.strip():
        raise ValueError('GENERATED_ARENA_AND_DIRECT_INSPECTION_REQUIRED')
    style = get_style(job['style_id'])
    record = {'job': job['id'], 'style_id': style['id'], 'source': job['source'], 'sha256': job['sha256'],
              'style_hash': digest(style), 'pair_input_hash': digest([input_record(style, s) for s in ('arena', 'camp')]),
              'verdict': 'exploration-sibling-ready', 'reviewer': 'executing-agent', 'note': note,
              'owner_accepted': False, 'label': 'authored direct pixel observation; not felt', 'gate': result}
    write(ART / 'proofs' / (style['id'] + '.json'), record)
    return record
