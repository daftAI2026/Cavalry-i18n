# abi_2_8_1/x86_64/
> L3 | 父级: ../CLAUDE.md

Cavalry 2.8.1 Intel专属ABI与构建输入。共享composer按显式x86_64目标覆盖隔离源码树；不借用ARM地址，不修改历史2.8.0合同。依赖版本与其他平台相同，运行库只链接所选官方App同bundle的Intel切片。

成员清单

- `build_x86_64_candidate.sh`：从既有Intel完整构建流程增量适配281；使用fmt11、spdlog1.15与Qt6.9.2。源码、字节、owner、原函数透传及链接验证分别保留。
- `title_format_abi_contract.h`：Intel SysV fmt11标题caller、源对象及双向fallback相对地址；短字符串tag在首字节。
- `check_title_contract.py`：构建后核对实际官方标题字节、唯一fmt11 import和候选two-level绑定。

- `native_candidate_architecture*.h/cpp`：目标UUID与架构准入、未知caller及头文件编译夹具。
- `native_font_x86_64_abi_contract.h`、`getpath_*contract.h`、`viewport_*h`、`timeline_*h`：既有Intel字体、FPS、Graph、Timeline与Viewport的281身份和owner窗口。
- `check_font_abi_x86_64.py`、`check_getpath_cache_x86_64.py`、`check_timeline_owner_observer_x86_64.py`：只读官方切片字节、符号和寄存器合同。
- `dependency_node_font_abi_contract.h`、`check_dependency_node_font_abi.py`：NodeView Name/Type、标准libc++名称源、measure/draw调用帧与静态核验。
- `native_locale*contract.h`、`help_popup_layout*`：locale sret与帮助布局ABI及C++夹具。
- `demo_reader_abi_contract.h`、`save_scene_caption_abi_contract.h`、`welcome_log_it_abi_contract.h`、`dg_context_menu_abi_contract.h`：Demo、Save/Open、Welcome和五个菜单固定调用点。
- `check_locale_popup_contract.py`：合并核对locale、Popup与上述固定调用点。

281独立ABI、完整native编译/链接及Intel App成品门已验证；实屏结果不能由构建通过推定。既有Intel未准入的ARM专属Fast/Guide/help-description/easing路径仍透传，不为本次依赖升级扩展范围。

[PROTOCOL]: 目标合同、构建入口或成员变化时同步父级地图；验收只记录实际执行结果。
