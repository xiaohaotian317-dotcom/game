"""Verify the signed APK and every bundled web asset before versioned delivery."""
from pathlib import Path
import hashlib, json, re, shutil, struct, zipfile

root = Path(__file__).resolve().parents[1]
apk = root / 'mobile/android/app/build/outputs/apk/release/app-release.apk'
version, code = '0.1.2', 3
delivery = root.parent / f'发行/秘境决斗-安卓试玩-{version}.apk'
validation = root / 'validation'
manifest = json.loads((validation / 'android1-web-manifest.json').read_text(encoding='utf-8-sig'))
badging = (validation / 't49-release-badging.txt').read_text(encoding='utf-8-sig')
permissions = (validation / 't49-release-permissions.txt').read_text(encoding='utf-8-sig')
signature = (validation / 't49-release-signature.txt').read_text(encoding='utf-8-sig')
alignment = (validation / 't49-release-alignment.txt').read_text(encoding='utf-8-sig')
cert = '50197c82d598e52d6866a7d6855c45906f70d12612c4ee280b229cce5fed517a'
assert "name='com.xiaohaotian.arcaneduel'" in badging
assert f"versionCode='{code}'" in badging and f"versionName='{version}'" in badging
assert "sdkVersion:'28'" in badging and 'application-debuggable' not in badging
assert cert in signature and 'Verification successful' in alignment
assert 'QUERY_ALL_PACKAGES' not in permissions and 'REQUEST_INSTALL_PACKAGES' not in permissions

def digest_file(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

checked, elf = 0, []
with zipfile.ZipFile(apk) as bundle:
    names = bundle.namelist()
    private_names = {'signing.properties', 'taptap.properties', 'dirichlet.properties'}
    assert not any('.private/' in n or n.endswith(('.jks', '.keystore')) or Path(n).name in private_names for n in names)
    for item in manifest['files']:
        data = bundle.read('assets/public/' + item['path'])
        assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
        assert digest_file(root / 'mobile/web' / item['path']) == item['sha256'], item['path']
        checked += 1
    for name in names:
        if not name.endswith('.so'):
            continue
        data = bundle.read(name)
        assert data[:4] == b'\x7fELF'
        endian = '<' if data[5] == 1 else '>'
        is64 = data[4] == 2
        offset = struct.unpack_from(endian + ('Q' if is64 else 'I'), data, 32 if is64 else 28)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 54 if is64 else 42)
        aligns = []
        for i in range(count):
            base = offset + i * size
            if struct.unpack_from(endian + 'I', data, base)[0] == 1:
                aligns.append(struct.unpack_from(endian + ('Q' if is64 else 'I'), data, base + (48 if is64 else 28))[0])
        elf.append({'file': name, 'minLoadAlignment': min(aligns) if aligns else None})

digest = digest_file(apk)
delivery.parent.mkdir(exist_ok=True)
if delivery.exists():
    assert digest_file(delivery) == digest, 'Never overwrite a different delivered APK'
else:
    shutil.copyfile(apk, delivery)
assert digest_file(delivery) == digest
report = {
    'package': 'com.xiaohaotian.arcaneduel', 'versionName': version, 'versionCode': code,
    'build': manifest['build'], 'apk': str(delivery), 'bytes': apk.stat().st_size, 'sha256': digest,
    'signingCertificateSha256': cert, 'sameOriginalSigningKey': True, 'debuggable': False,
    'minSdk': 28, 'targetSdk': 36, 'webAssetsMatched': checked, 'zip16KAligned': True,
    'nativeLibraries': elf, 'nativeElf16KAligned': all(e['minLoadAlignment'] and e['minLoadAlignment'] >= 16384 for e in elf),
    'tapConfigured': True, 'ads': {'sdk': 'TapADN5.3.2.0', 'environment': 'test', 'supportedPrimaryAbis': ['arm64-v8a', 'armeabi-v7a'], 'unsupportedAbiBlockedBeforeInit': True, 'realRevenueVerified': False},
    'physicalPhoneInstalledThisVersion': False, 'physicalPhoneDeferredByUser': True,
    'realInternetMatchVerified': False, 'publishedToTapTap': False,
    'scope': 'Signed local APK with exact bundled asset hashes. Actual installed debug/emulator checks are separately recorded; no physical-phone or real-internet claim.'
}
(validation / 't49-android-package.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'nativeLibraries'}, ensure_ascii=False, indent=2))
