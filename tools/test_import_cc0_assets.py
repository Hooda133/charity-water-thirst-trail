#!/usr/bin/env python3
"""Offline safety tests; no asset-site network calls."""
import importlib.util
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).with_name('import_cc0_assets.py')
spec = importlib.util.spec_from_file_location('asset_importer', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def make_zip(files):
    blob = io.BytesIO()
    with zipfile.ZipFile(blob, 'w', compression=zipfile.ZIP_DEFLATED) as writer:
        for name, data in files.items():
            writer.writestr(name, data)
    return blob.getvalue()


class DownloaderSafetyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = mod.OUTPUT
        self.old_root = mod.ROOT
        mod.ROOT = Path(self.tmp.name)
        mod.OUTPUT = Path(self.tmp.name) / 'assets'
        mod.OUTPUT.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        mod.OUTPUT = self.old
        mod.ROOT = self.old_root
        self.tmp.cleanup()

    def test_curated_glb_and_texture(self):
        files = {
            'Models/GLB format/plant.glb': b'glTF' + b'\x02\x00\x00\x00' + b'\x0c\x00\x00\x00',
            'Models/GLB format/Textures/colormap.png': b'\x89PNG\r\n\x1a\n' + b'EXAMPLE',
            'not-for-import.bat': b'dont import me',
        }
        names=list(files)[:2]
        records = {}
        mod.unpack_archive(make_zip(files), names, 'kenney/test', provider='kenney',
                           source='https://kenney.nl/assets/test', license_id='CC0-1.0', records=records)
        self.assertEqual(len(records), 2)
        self.assertTrue((mod.OUTPUT / 'kenney/test/plant.glb').exists())
        self.assertTrue((mod.OUTPUT / 'kenney/test/Textures/colormap.png').exists())
        self.assertFalse((mod.OUTPUT / 'not-for-import.bat').exists())
        mod.unpack_archive(make_zip(files), names, 'kenney/test', provider='kenney',
                           source='https://kenney.nl/assets/test', license_id='CC0-1.0', records=records)
        self.assertEqual(len(records), 2)

    def test_blocks_archive_traversal(self):
        with self.assertRaises(ValueError):
            mod.unpack_archive(make_zip({'../outside.glb': b'glTF12345678'}), None,
                               'kenney/test', provider='kenney',
                               source='https://kenney.nl/assets/test',license_id='CC0-1.0',records={})

    def test_blocks_unverified_license_and_untrusted_host(self):
        with self.assertRaises(ValueError):
            mod.safe_url('https://other.example/file.zip', 'kenney')
        with self.assertRaises(ValueError):
            mod.remember('kenney/test/plant.glb', b'glTF12345678',provider='kenney',
                         source='https://kenney.nl',license_id='private',records={})
        with self.assertRaises(ValueError):
            mod.remember('kenney/test/plant.glb', b'glTF12345678',provider='kenney',
                         source='https://kenney.nl',license_id='CC-BY-4.0',records={})

    def test_refuses_changed_download_and_invalid_glb(self):
        mod.remember('kenney/test/plant.glb', b'glTF12345678', provider='kenney',
                     source='https://kenney.nl',license_id='CC0-1.0',records={})
        with self.assertRaises(ValueError):
            mod.remember('kenney/test/plant.glb', b'glTFabcdefgh', provider='kenney',
                         source='https://kenney.nl',license_id='CC0-1.0',records={})
        with self.assertRaises(ValueError):
            mod.valid_asset(mod.safe_path('bad.glb'),b'not a glb')


if __name__ == '__main__':
    unittest.main()
