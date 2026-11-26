import migration00 from './00_use_single_api_key_and_url';
import migration01 from './01_remove_obsolete_config_keys_from_global_file';
import migration02 from './02_set_missing_default_values';
import migration03 from './03_replace_removed_providers';

export const migrations = [
  // Runs first: migration 00 fails for a provider without legacy settings, and
  // the removed providers skipped migrations 00 to 02 until now.
  {
    name: '03_replace_removed_providers',
    run: migration03
  },
  {
    name: '00_use_single_api_key_and_url',
    run: migration00
  },
  {
    name: '01_remove_obsolete_config_keys_from_global_file',
    run: migration01
  },
  {
    name: '02_set_missing_default_values',
    run: migration02
  }
];
