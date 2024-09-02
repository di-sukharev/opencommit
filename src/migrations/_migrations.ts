import migration00 from './00_use_single_api_key_and_url';
import migration01 from './01_remove_obsolete_config_keys_from_global_file';

export const migrations = [
  {
    name: '00_use_single_api_key_and_url',
    run: migration00
  },
  {
    name: '01_remove_obsolete_config_keys_from_global_file',
    run: migration01
  }
];
