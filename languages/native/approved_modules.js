/**
 * [INPUT]: 依赖同目录已登记UI审批批次；2.8.1只选择独立source-bound delta并过滤已删除键。
 * [OUTPUT]: 提供按Cavalry版本选择的显式原生UI审批列表；默认仍为2.8.0。
 * [POS]: languages/native 的审批装配边界；构建不依赖AGY/Grok或私库。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const APPROVED_MODULES = Object.freeze([
  'reviewed_translations', 'ai_studio_supplement', 'ai_studio_reuse_and_credits',
  'canva_and_assets', 'menus_file_edit_create_help', 'menus_comp_animation',
  'menus_view_window', 'menus_other', 'official_demo_menus', 'nodes_group_transform_null', 'nodes_shape',
  'nodes_text_shape', 'nodes_basic_primitives', 'nodes_accumulator_renderqueue',
  'nodes_apply_opentype', 'runtime_observed_supplement', 'nodes_auto_animate', 'nodes_sound', 'nodes_sound_legacy', 'nodes_rgb_split', 'nodes_slit_scan', 'nodes_array_distribution', 'nodes_align_distortion_glow',
  'nodes_apply_distribution', 'nodes_apply_layout', 'nodes_bevel', 'nodes_boolean', 'nodes_chop_path', 'nodes_color_material', 'nodes_count_sub_meshes', 'nodes_material_behaviour_hsv', 'nodes_stroke_material', 'nodes_sub_mesh',
  'nodes_apply_character_spacing', 'nodes_falloff', 'nodes_path_split', 'nodes_four_point_warp', 'nodes_bar_chart', 'nodes_dithering_filter',
  'nodes_mesh_distribution', 'nodes_mesh_shape', 'nodes_path_field',
  'nodes_random_distribution', 'nodes_sksl_filter', 'nodes_third_party_filter',
  "guides", "plugins_bilateral_blur", "plugins_box_blur", "plugins_bulge", "plugins_chroma_key", "plugins_directional_blur", "plugins_erosion", "plugins_gaussian_blur", "plugins_grain", "plugins_light_sweep", "plugins_polar_coordinates", "plugins_ripple", "plugins_spherise", "plugins_twist", "plugins_zoom_blur",
  'remaining_global_ui_01',
  'remaining_global_ui_02',
  'remaining_global_ui_03',
  'remaining_node_ui_a_01',
  'remaining_node_ui_a_02',
  'remaining_node_ui_a_03',
  'remaining_node_ui_b_01',
  'remaining_global_ui_04',
  'remaining_node_ui_b_02',
  'remaining_global_ui_05',
  'remaining_node_ui_b_03',
  'remaining_global_ui_06',
  'remaining_node_ui_a_04',
  'remaining_node_ui_a_05',
  'remaining_node_ui_b_06',
  'remaining_node_ui_a_06',
  'remaining_node_ui_b_04',
  'remaining_node_ui_b_05',
  'forge_attribute_supplement',
  'schema_attribute_gap_a',
  'schema_attribute_gap_b', 'plugin_caption_supplement',
]);
function approvedEntries(cavalryVersion = '2.8.0') {
  const base = APPROVED_MODULES.flatMap(name => require(`./${name}.js`).entries);
  if (cavalryVersion === '2.8.0') return base;
  if (cavalryVersion !== '2.8.1') throw new Error(`unsupported native approval target: ${cavalryVersion}`);

  const { entries, removedEntries } = require('./release_2_8_1_delta');
  const replacedKeys = new Set(entries.map(row => row.key));
  const removedKeys = new Set(removedEntries.map(row => row.key));
  return [...base.filter(row => !replacedKeys.has(row.key) && !removedKeys.has(row.key)), ...entries];
}
module.exports = { APPROVED_MODULES, approvedEntries };
