#!/usr/bin/env python3
"""Write or check the <MD5> of every download in the .plg.

Unraid's plugin manager compares each downloaded file with its <MD5>, and
Community Applications requires one on every <URL>. Files from the tag
(&gitURL;/path) are hashed from the working tree; the release binary
(&releaseURL;/name) from the file given with --binary name=path.

  scripts/plg-hashes.py plugin/ugreen-nas-control.plg --binary ugreen-nas-fan=build/ugreen-nas-fan --binary ugreen-led-i2c=build/ugreen-led-i2c
  scripts/plg-hashes.py plugin/ugreen-nas-control.plg --binary ugreen-nas-fan=fan/ugreen-nas-fan --binary ugreen-led-i2c=led/i2c/ugreen-led-i2c --check
"""
import argparse
import hashlib
import os
import re
import sys

FILE_RE = re.compile(r'(<FILE Name="[^"]*">\n<URL>([^<]*)</URL>\n)(?:<MD5>[0-9a-f]*</MD5>\n)?(</FILE>)')


def md5(path):
    with open(path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('plg')
    parser.add_argument('--binary', action='append', default=[], help='name=path of a release asset')
    parser.add_argument('--check', action='store_true', help='only compare, exit 1 on a mismatch')
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    binaries = dict(b.split('=', 1) for b in args.binary)
    with open(args.plg) as f:
        text = f.read()
    problems = []

    def replace(match):
        head, url, tail = match.group(1), match.group(2), match.group(3)
        old = re.search(r'<MD5>([0-9a-f]*)</MD5>', match.group(0))
        old = old.group(1) if old else None

        if url.startswith('&gitURL;/'):
            path = os.path.join(root, url[len('&gitURL;/'):])
        elif url.startswith('&releaseURL;/'):
            name = url[len('&releaseURL;/'):]
            if name not in binaries:
                problems.append(f'{url}: no --binary {name}=path given')
                return match.group(0)
            path = binaries[name]
        else:
            problems.append(f'{url}: unknown download source')
            return match.group(0)

        try:
            new = md5(path)
        except OSError as e:
            problems.append(f'{url}: cannot read {path}: {e.strerror}')
            return match.group(0)
        if old != new:
            problems.append(f'{url}: plg has {old}, file is {new}')
        return f'{head}<MD5>{new}</MD5>\n{tail}'

    updated, count = FILE_RE.subn(replace, text)

    if args.check:
        for p in problems:
            print(p, file=sys.stderr)
        if problems:
            print('Run scripts/plg-hashes.py without --check and commit the result.', file=sys.stderr)
            return 1
        print(f'All {count} downloads match their MD5.')
        return 0

    # The hashes that could be computed are still written; the exit code says the rest is stale.
    with open(args.plg, 'w') as f:
        f.write(updated)
    for p in problems:
        print(p, file=sys.stderr)
    print(f'{count} downloads hashed.')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
