/**
 * [INPUT]: 依赖 Qt 6.6.3 runtime ABI、QRegularExpression、AppKit (NSApp mainMenu)、generated_translations.inc 编译期翻译表
 * [OUTPUT]: 对外提供 EmbeddedTranslator、Qt UI 翻译、自动编号显示名后缀保留、运行时生成图层名显示层翻译、QLineEdit/QLabel 后续文本显示翻译、模型 niceName item 写回保护、ABI-safe Time Editor 上下文识别、懒加载菜单首次绘制前翻译、动态菜单/状态栏/冒号标签与 No 前缀混合文本兜底翻译、AppKit 菜单同步与带坐标父链/Qt item model 的运行时 inventory 导出（ExtensionLayer 自绘层 Latin-only 字体无法渲染 CJK，保持英文原文）
 * [POS]: injector 核心注入源，通过 DYLD_INSERT_LIBRARIES 拦截 Qt 翻译请求；Time Editor 模型词汇与 ExtensionLayer 自绘提示保留英文原文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <CommonCrypto/CommonDigest.h>
#import <Foundation/Foundation.h>

#include <dispatch/dispatch.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <qdatetime.h>
#include <QEvent>
#include <qcoreapplication.h>
#include <qfileinfo.h>
#include <qglobal.h>
#include <QtGui/qaction.h>
#include <QtGui/qcursor.h>
#include <QtCore/qabstractitemmodel.h>
#include <QtWidgets/qabstractitemview.h>
#include <QtWidgets/qabstractbutton.h>
#include <QtWidgets/qapplication.h>
#include <QtWidgets/qcombobox.h>
#include <QtWidgets/qgroupbox.h>
#include <QtWidgets/qlabel.h>
#include <QtWidgets/qlineedit.h>
#include <QtWidgets/qdialogbuttonbox.h>
#include <QtWidgets/qdockwidget.h>
#include <QtWidgets/qheaderview.h>
#include <QtWidgets/qlistwidget.h>
#include <QtWidgets/qmenu.h>
#include <QtWidgets/qmenubar.h>
#include <QtWidgets/qprogressbar.h>
#include <QtWidgets/qspinbox.h>
#include <QtWidgets/qstatusbar.h>
#include <QtWidgets/qtabbar.h>
#include <QtWidgets/qtablewidget.h>
#include <QtWidgets/qtabwidget.h>
#include <QtWidgets/qtoolbar.h>
#include <QtWidgets/qtoolbutton.h>
#include <QtWidgets/qtreewidget.h>
#include <QtWidgets/qwidget.h>
#include <qhash.h>
#include <qpoint.h>
#include <qpointer.h>
#include <qregularexpression.h>
#include <qrect.h>
#include <qset.h>
#include <QSignalBlocker>
#include <qstring.h>
#include <qstringlist.h>
#include <qtranslator.h>
#include <qvariant.h>
#include <qvector.h>

namespace {

constexpr int kMaxInstallAttempts = 20;
constexpr int kRetryDelayMs = 250;
constexpr int kWarmupRefreshAttempts = 3;
constexpr int kRefreshDelayMs = 1000;
constexpr int kDirtyDrainMaxObjects = 32;

struct TranslationEntry {
    const char *context;
    const char *sourceText;
    const char *translation;
};

#include "generated_translations.inc"

/* -----------------------------------------------------------------------
 * ExtensionLayer 自绘提示 — 保留英文原文，不做 CJK 补丁
 *
 * ExtensionLayer 的 overlay text renderer 使用硬编码 Latin-only 字体，
 * 没有 CJK glyph 也没有 fallback 链。写入 CJK 后每个字符显示为 ?。
 * Qt 通道的翻译不受影响，仅此自绘层保持英文。
 * ----------------------------------------------------------------------- */
const TranslationEntry *entriesForLanguageName(const char *lang, int *count)
{
    if (lang == nullptr) {
        *count = 0;
        return nullptr;
    }
    if (strcmp(lang, "zh-Hans") == 0) {
        *count = static_cast<int>(sizeof(kZhHansEntries) / sizeof(kZhHansEntries[0]));
        return kZhHansEntries;
    }
    if (strcmp(lang, "zh-Hant") == 0) {
        *count = static_cast<int>(sizeof(kZhHantEntries) / sizeof(kZhHantEntries[0]));
        return kZhHantEntries;
    }
    if (strcmp(lang, "ja_JP") == 0) {
        *count = static_cast<int>(sizeof(kJaEntries) / sizeof(kJaEntries[0]));
        return kJaEntries;
    }

    *count = 0;
    return nullptr;
}

const char *embeddedTranslationForSource(const char *lang, const char *sourceText)
{
    int count = 0;
    const TranslationEntry *entries = entriesForLanguageName(lang, &count);
    if (entries == nullptr || sourceText == nullptr) {
        return nullptr;
    }

    for (int index = 0; index < count; ++index) {
        if (strcmp(entries[index].sourceText, sourceText) == 0) {
            return entries[index].translation;
        }
    }

    return nullptr;
}

QString normalizeMenuText(const QString &text);

bool isTimeEditorItemWidget(QWidget *widget)
{
    if (widget == nullptr) {
        return false;
    }

    const QStringList probes = {
        QString::fromUtf8(widget->metaObject()->className()),
        widget->objectName(),
        widget->property("accessibleName").toString(),
        widget->property("accessibleDescription").toString(),
    };
    for (const QString &probe : probes) {
        const QString normalized = normalizeMenuText(probe);
        if (normalized.contains(QStringLiteral("Time Editor"), Qt::CaseInsensitive) ||
            normalized.contains(QStringLiteral("TimeEditor"), Qt::CaseInsensitive)) {
            return true;
        }
    }
    return false;
}

bool shouldPreserveModelBackedItemText(QWidget *owner, const QString &sourceText)
{
    if (owner == nullptr || sourceText.isEmpty() || !isTimeEditorItemWidget(owner)) {
        return false;
    }

    QString source = normalizeMenuText(sourceText);
    source.remove(QRegularExpression(QStringLiteral("\\s+[0-9]+$")));
    source = source.trimmed();
    if (source.isEmpty()) {
        return false;
    }

    static const QSet<QString> kModelBackedItemTexts = {
        QStringLiteral("3D Matrix"),
        QStringLiteral("4-Point Warp"),
        QStringLiteral("Accumulator"),
        QStringLiteral("Add Divisions"),
        QStringLiteral("Align"),
        QStringLiteral("Alpha Material Override"),
        QStringLiteral("Animation Control"),
        QStringLiteral("APNG"),
        QStringLiteral("Apply Character Spacing"),
        QStringLiteral("Apply Distribution"),
        QStringLiteral("Apply Font Size"),
        QStringLiteral("Apply Font Style"),
        QStringLiteral("Apply Layout"),
        QStringLiteral("Apply OpenType"),
        QStringLiteral("Apply Text Fill"),
        QStringLiteral("Apply Text Material"),
        QStringLiteral("Apply Typeface"),
        QStringLiteral("Arc"),
        QStringLiteral("Area Range"),
        QStringLiteral("Array"),
        QStringLiteral("Array Manipulator"),
        QStringLiteral("Arrow"),
        QStringLiteral("Asset Array"),
        QStringLiteral("Asset From Smart Folder"),
        QStringLiteral("Atomic"),
        QStringLiteral("Attractor Field"),
        QStringLiteral("Audio Only"),
        QStringLiteral("Auto-Animate"),
        QStringLiteral("Auto-Crop"),
        QStringLiteral("Background Blur"),
        QStringLiteral("Background Shape"),
        QStringLiteral("Bar Chart"),
        QStringLiteral("Barbed"),
        QStringLiteral("Basic Line"),
        QStringLiteral("Basic Shape"),
        QStringLiteral("Behaviour"),
        QStringLiteral("Behaviour Base"),
        QStringLiteral("Behaviour Mixer"),
        QStringLiteral("Bend"),
        QStringLiteral("Bento"),
        QStringLiteral("Bevel"),
        QStringLiteral("Bézier"),
        QStringLiteral("Bilateral Blur"),
        QStringLiteral("Black and White"),
        QStringLiteral("Blend Shader"),
        QStringLiteral("Blend Shape"),
        QStringLiteral("Blend Sub-Mesh Positions"),
        QStringLiteral("Block"),
        QStringLiteral("Body Settings Collision Event"),
        QStringLiteral("Bone"),
        QStringLiteral("Boolean"),
        QStringLiteral("Bounding Box"),
        QStringLiteral("Bounding Box Constraint"),
        QStringLiteral("Box"),
        QStringLiteral("Box Blur"),
        QStringLiteral("Bridge Constraint"),
        QStringLiteral("Brightness And Contrast"),
        QStringLiteral("Bulge"),
        QStringLiteral("Buoyancy Field"),
        QStringLiteral("Camera"),
        QStringLiteral("Camera Guide"),
        QStringLiteral("Capsule"),
        QStringLiteral("Cellular Noise"),
        QStringLiteral("Change String Case"),
        QStringLiteral("Chart"),
        QStringLiteral("Checkerboard Shader"),
        QStringLiteral("Chevron"),
        QStringLiteral("Chop Path"),
        QStringLiteral("Chroma Key"),
        QStringLiteral("Chromatic Aberration"),
        QStringLiteral("Chromatic Displacement"),
        QStringLiteral("Circle"),
        QStringLiteral("Clean Up"),
        QStringLiteral("Cogwheel"),
        QStringLiteral("Cogwheel (Gear)"),
        QStringLiteral("Color Array"),
        QStringLiteral("Color Blend"),
        QStringLiteral("Color Collision Event"),
        QStringLiteral("Color Info"),
        QStringLiteral("Color Material Override"),
        QStringLiteral("Color Shader"),
        QStringLiteral("Comparison"),
        QStringLiteral("Component"),
        QStringLiteral("Component Constraint"),
        QStringLiteral("Composition"),
        QStringLiteral("Composition Constraint"),
        QStringLiteral("Conical Gradient"),
        QStringLiteral("Connect Shape"),
        QStringLiteral("Contours to Sub-Meshes"),
        QStringLiteral("Contrasting Color"),
        QStringLiteral("Control Centre Button Name"),
        QStringLiteral("Convex Hull"),
        QStringLiteral("Corner Pin"),
        QStringLiteral("Count Sub-Meshes"),
        QStringLiteral("Cubic Noise"),
        QStringLiteral("Curves To Lines"),
        QStringLiteral("Custom Shape"),
        QStringLiteral("Custom..."),
        QStringLiteral("Data Modifier"),
        QStringLiteral("Direction Field"),
        QStringLiteral("Directional Blur"),
        QStringLiteral("Displacement Utility"),
        QStringLiteral("Distance"),
        QStringLiteral("Distance Constraint"),
        QStringLiteral("Distort Edges"),
        QStringLiteral("Distortion"),
        QStringLiteral("Distribution Emitter"),
        QStringLiteral("Dithering"),
        QStringLiteral("Drag Field"),
        QStringLiteral("Drawable"),
        QStringLiteral("Drop Shadow"),
        QStringLiteral("Duplicator"),
        QStringLiteral("Editable Shape"),
        QStringLiteral("Edge Constraint"),
        QStringLiteral("Edge Detection"),
        QStringLiteral("Element"),
        QStringLiteral("Ellipse"),
        QStringLiteral("End"),
        QStringLiteral("End Rotation"),
        QStringLiteral("Erosion"),
        QStringLiteral("Extend Open Paths"),
        QStringLiteral("Extract Sub-Meshes"),
        QStringLiteral("Extrude"),
        QStringLiteral("Falloff"),
        QStringLiteral("Fast Blur"),
        QStringLiteral("Fibonacci"),
        QStringLiteral("Fill"),
        QStringLiteral("Fill Color"),
        QStringLiteral("Fill Rule"),
        QStringLiteral("Filter"),
        QStringLiteral("Flare"),
        QStringLiteral("Flatten Shape Layers"),
        QStringLiteral("Flow Field Modifier"),
        QStringLiteral("Footage Shape"),
        QStringLiteral("Force Modifier"),
        QStringLiteral("Forge Dynamics"),
        QStringLiteral("Forge Dynamics Shape"),
        QStringLiteral("Formatted Date and Time"),
        QStringLiteral("Formatted String"),
        QStringLiteral("Four Point Warp"),
        QStringLiteral("Frame"),
        QStringLiteral("Frosted Glass"),
        QStringLiteral("Gamma Correction"),
        QStringLiteral("Gaussian Blur"),
        QStringLiteral("Gaussian Drop Shadow"),
        QStringLiteral("Get Name"),
        QStringLiteral("Get Sub-Mesh Transform"),
        QStringLiteral("Get Vector"),
        QStringLiteral("GIF"),
        QStringLiteral("Glow"),
        QStringLiteral("Goal Modifier"),
        QStringLiteral("Gradient Map"),
        QStringLiteral("Gradient Shader"),
        QStringLiteral("Grain"),
        QStringLiteral("Grid"),
        QStringLiteral("Grid Layout"),
        QStringLiteral("Grid Layout Group"),
        QStringLiteral("Grid Layout Row"),
        QStringLiteral("Group"),
        QStringLiteral("Halftone"),
        QStringLiteral("Hash"),
        QStringLiteral("Hexadecimal"),
        QStringLiteral("Horizontal Layout"),
        QStringLiteral("HSL"),
        QStringLiteral("HSV Adjustment"),
        QStringLiteral("HSV Color"),
        QStringLiteral("HSV Material Override"),
        QStringLiteral("HVEC / H.265"),
        QStringLiteral("If Else"),
        QStringLiteral("IK Control"),
        QStringLiteral("Image Modifier"),
        QStringLiteral("Image Sampler"),
        QStringLiteral("Image Shader"),
        QStringLiteral("Image To Shapes"),
        QStringLiteral("Impulse Collision Event"),
        QStringLiteral("Index Context"),
        QStringLiteral("Index To Color"),
        QStringLiteral("Inner Shadow"),
        QStringLiteral("Intersections"),
        QStringLiteral("Invert"),
        QStringLiteral("Is Within"),
        QStringLiteral("Isolines"),
        QStringLiteral("JavaScript Deformer"),
        QStringLiteral("JavaScript Emitter"),
        QStringLiteral("JavaScript Modifier"),
        QStringLiteral("JavaScript Shape"),
        QStringLiteral("JavaScript Utility"),
        QStringLiteral("Join String"),
        QStringLiteral("JPEG Sequence"),
        QStringLiteral("Kitaoka Filter"),
        QStringLiteral("Knot"),
        QStringLiteral("Lattice"),
        QStringLiteral("Lattice Controller"),
        QStringLiteral("Layer Seed"),
        QStringLiteral("Layout Group"),
        QStringLiteral("Layout Shape"),
        QStringLiteral("Length Context"),
        QStringLiteral("Levels"),
        QStringLiteral("Light Sweep"),
        QStringLiteral("Line"),
        QStringLiteral("Line Chart"),
        QStringLiteral("Linear"),
        QStringLiteral("Linear Gradient"),
        QStringLiteral("Linear Wipe"),
        QStringLiteral("Local Time"),
        QStringLiteral("Logic"),
        QStringLiteral("Look At"),
        QStringLiteral("Lottie"),
        QStringLiteral("Luminance Blur"),
        QStringLiteral("Magnetic Modifier"),
        QStringLiteral("Manipulate Array"),
        QStringLiteral("Manipulator"),
        QStringLiteral("Mask"),
        QStringLiteral("Mask Blur"),
        QStringLiteral("Material Sampler"),
        QStringLiteral("Math"),
        QStringLiteral("Math2"),
        QStringLiteral("Math3"),
        QStringLiteral("Measure"),
        QStringLiteral("Measure Text"),
        QStringLiteral("Merge"),
        QStringLiteral("Mesh Shape"),
        QStringLiteral("Mesh Solver"),
        QStringLiteral("Mirror"),
        QStringLiteral("Mix Shader"),
        QStringLiteral("Modulate"),
        QStringLiteral("Morph"),
        QStringLiteral("Motion Blur"),
        QStringLiteral("Motion Stretch"),
        QStringLiteral("MP4"),
        QStringLiteral("Multi-Point Gradient Shader"),
        QStringLiteral("Noise"),
        QStringLiteral("Noise Shader"),
        QStringLiteral("Normalize Path Direction"),
        QStringLiteral("Null"),
        QStringLiteral("Number Range"),
        QStringLiteral("Number Range To Color"),
        QStringLiteral("Oscillator"),
        QStringLiteral("Outline"),
        QStringLiteral("Particle"),
        QStringLiteral("Particle Emitter"),
        QStringLiteral("Particle Modifier"),
        QStringLiteral("Particle Shape"),
        QStringLiteral("Path"),
        QStringLiteral("Path Average"),
        QStringLiteral("Path Field"),
        QStringLiteral("Path Length"),
        QStringLiteral("Path Modifier"),
        QStringLiteral("Path Offset"),
        QStringLiteral("Path Relax"),
        QStringLiteral("Path Split"),
        QStringLiteral("Pathfinder"),
        QStringLiteral("Pattern"),
        QStringLiteral("Pie Chart"),
        QStringLiteral("Pin Constraint"),
        QStringLiteral("Pinch"),
        QStringLiteral("Pixel Sorting"),
        QStringLiteral("Pixelate"),
        QStringLiteral("PNG Sequence"),
        QStringLiteral("Point"),
        QStringLiteral("Point Constraint"),
        QStringLiteral("Point Displacer"),
        QStringLiteral("Points to Path"),
        QStringLiteral("Polar Coordinates"),
        QStringLiteral("Polygon"),
        QStringLiteral("Position Blend"),
        QStringLiteral("Posterize"),
        QStringLiteral("Pre-Comp"),
        QStringLiteral("ProRes"),
        QStringLiteral("Push Along Vector"),
        QStringLiteral("Quad Tree Shape"),
        QStringLiteral("QuickTime"),
        QStringLiteral("Radial Gradient"),
        QStringLiteral("Radial Wipe"),
        QStringLiteral("Radius"),
        QStringLiteral("Random"),
        QStringLiteral("Random Date"),
        QStringLiteral("Random Number"),
        QStringLiteral("Range Falloff"),
        QStringLiteral("Ray"),
        QStringLiteral("Rectangle"),
        QStringLiteral("Rectangle Pattern"),
        QStringLiteral("Regex"),
        QStringLiteral("Remove Contours"),
        QStringLiteral("Replace String"),
        QStringLiteral("Resample Path"),
        QStringLiteral("Resize Array"),
        QStringLiteral("Resize String"),
        QStringLiteral("Reverse Path"),
        QStringLiteral("RGB Split"),
        QStringLiteral("Rig Control"),
        QStringLiteral("Ring"),
        QStringLiteral("Rose"),
        QStringLiteral("Round"),
        QStringLiteral("Rubber Hose Limb"),
        QStringLiteral("Scan Lines"),
        QStringLiteral("Scheduling Group"),
        QStringLiteral("Scrape"),
        QStringLiteral("Seconds To Frames"),
        QStringLiteral("Segment Path"),
        QStringLiteral("Sequence"),
        QStringLiteral("Shader"),
        QStringLiteral("Shader Array"),
        QStringLiteral("Shape"),
        QStringLiteral("Shape Array"),
        QStringLiteral("Shape Edges"),
        QStringLiteral("Shape Gradient"),
        QStringLiteral("Shape Points"),
        QStringLiteral("Shape to Shader"),
        QStringLiteral("Sharpen"),
        QStringLiteral("Shift Channels"),
        QStringLiteral("Shortest Path"),
        QStringLiteral("Shuffle"),
        QStringLiteral("Shuffle Array"),
        QStringLiteral("Shuffle String"),
        QStringLiteral("Simplex Noise"),
        QStringLiteral("Skeleton"),
        QStringLiteral("Skew"),
        QStringLiteral("Skinning"),
        QStringLiteral("SkSL Filter"),
        QStringLiteral("SkSL Shader"),
        QStringLiteral("SLA Shader"),
        QStringLiteral("Slit Scan"),
        QStringLiteral("Sort"),
        QStringLiteral("Sort Array"),
        QStringLiteral("Sound"),
        QStringLiteral("Spacer"),
        QStringLiteral("Speed Modifier"),
        QStringLiteral("Spherise"),
        QStringLiteral("Spiral"),
        QStringLiteral("Spreadsheet"),
        QStringLiteral("Spreadsheet Lookup"),
        QStringLiteral("Spring"),
        QStringLiteral("Sprite Sheet"),
        QStringLiteral("Squash and Stretch"),
        QStringLiteral("Squircle"),
        QStringLiteral("Stagger"),
        QStringLiteral("Star"),
        QStringLiteral("Start"),
        QStringLiteral("Start Rotation"),
        QStringLiteral("Sticky Collision Event"),
        QStringLiteral("Stitches"),
        QStringLiteral("String"),
        QStringLiteral("String Array"),
        QStringLiteral("String From Asset"),
        QStringLiteral("String Generator"),
        QStringLiteral("String Length"),
        QStringLiteral("String Manipulator"),
        QStringLiteral("Stripes"),
        QStringLiteral("Stroke"),
        QStringLiteral("Stroke Duplicator"),
        QStringLiteral("Sub-Mesh"),
        QStringLiteral("Sub-Mesh Bounding Box"),
        QStringLiteral("Sub-String"),
        QStringLiteral("Subdivide"),
        QStringLiteral("Super Ellipse"),
        QStringLiteral("Super Shape"),
        QStringLiteral("SVG"),
        QStringLiteral("SVG Sequence"),
        QStringLiteral("Swap Color"),
        QStringLiteral("Sweep Gradient"),
        QStringLiteral("This is the name given to the button for this item in Cavalry Control."),
        QStringLiteral("Threshold"),
        QStringLiteral("Time Marker"),
        QStringLiteral("Timecode"),
        QStringLiteral("Timeline Counter"),
        QStringLiteral("Toon Stroke"),
        QStringLiteral("Trails"),
        QStringLiteral("Transform"),
        QStringLiteral("Transform Constraint"),
        QStringLiteral("Transition String"),
        QStringLiteral("Travel"),
        QStringLiteral("TriTone"),
        QStringLiteral("Turbulence Modifier"),
        QStringLiteral("Typeface"),
        QStringLiteral("Typeface Array"),
        QStringLiteral("Unicode Offset"),
        QStringLiteral("Value"),
        QStringLiteral("Value Array"),
        QStringLiteral("Value Blend"),
        QStringLiteral("Value Noise"),
        QStringLiteral("Value Solver"),
        QStringLiteral("Value2"),
        QStringLiteral("Value2 Array"),
        QStringLiteral("Value2 Blend"),
        QStringLiteral("Value2 Solver"),
        QStringLiteral("Value3"),
        QStringLiteral("Value3 Array"),
        QStringLiteral("Value3 Blend"),
        QStringLiteral("Velocity Context"),
        QStringLiteral("Velocity Magnitude Context"),
        QStringLiteral("Venetian Blinds"),
        QStringLiteral("Vertical Layout"),
        QStringLiteral("Vignette"),
        QStringLiteral("Visibility Collision Event"),
        QStringLiteral("Visibility Sequence"),
        QStringLiteral("Visual Modifier"),
        QStringLiteral("Voronoi Shader"),
        QStringLiteral("Vortex Field"),
        QStringLiteral("Vortex Modifier"),
        QStringLiteral("Voxelize"),
        QStringLiteral("Wave"),
        QStringLiteral("WebM"),
        QStringLiteral("WebP Sequence"),
        QStringLiteral("Zoom Blur"),
    };

    return kModelBackedItemTexts.contains(source);
}

class EmbeddedTranslator final : public QTranslator {
public:
    explicit EmbeddedTranslator(const QString &lang, QObject *parent = nullptr)
        : QTranslator(parent), m_lang(lang)
    {
    }

    QString translate(
        const char *context,
        const char *sourceText,
        const char *disambiguation = nullptr,
        int n = -1) const override
    {
        (void) disambiguation;
        (void) n;

        if (context == nullptr || sourceText == nullptr) {
            return QString();
        }

        int count = 0;
        const TranslationEntry *entries = entriesForLanguage(m_lang, &count);
        if (entries == nullptr) {
            return QString();
        }

        for (int index = 0; index < count; ++index) {
            if (strcmp(entries[index].context, context) == 0 &&
                strcmp(entries[index].sourceText, sourceText) == 0) {
                return QString::fromUtf8(entries[index].translation);
            }
        }

        return QString();
    }

private:
    QString m_lang;
};

EmbeddedTranslator *gTranslator = nullptr;
bool gInstallAttempted = false;
bool gRefreshScheduled = false;
QSet<QMenu *> gHookedMenus;
QSet<QLineEdit *> gHookedLineEdits;
struct DirtyObject {
    QObject *key;
    QPointer<QObject> object;
};

QObject *gEventFilter = nullptr;
QVector<DirtyObject> gDirtyObjects;
QSet<QObject *> gDirtyObjectSet;
bool gDirtyDrainScheduled = false;
bool gInteractiveRefreshScheduled = false;
int gRefreshCount = 0;
int gDirtyEnqueueCount = 0;
int gDirtyDrainCount = 0;
int gDirtyObjectTranslateCount = 0;
QHash<QString, QString> gTranslationBySource;
QString gTranslationCacheLang;

QString readEnvVar(const char *name)
{
    const char *value = getenv(name);
    return value ? QString::fromUtf8(value) : QString();
}

NSString *toNSString(const QString &value);

NSString *runtimeCacheRoot()
{
    @autoreleasepool {
        const QString configured = readEnvVar("CAVALRY_I18N_CACHE_ROOT");
        if (!configured.isEmpty()) {
            return toNSString(configured);
        }
        return [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/Cavalry-i18n"];
    }
}

QString sessionUuidValue()
{
    const QString explicitSessionUuid = readEnvVar("CAVALRY_I18N_SESSION_UUID");
    if (!explicitSessionUuid.isEmpty()) {
        return explicitSessionUuid;
    }

    const QString sessionDir = readEnvVar("CAVALRY_I18N_SESSION_DIR");
    if (!sessionDir.isEmpty()) {
        return QFileInfo(sessionDir).fileName();
    }

    return QString();
}

NSString *runtimeSessionDir()
{
    @autoreleasepool {
        const QString configured = readEnvVar("CAVALRY_I18N_SESSION_DIR");
        if (!configured.isEmpty()) {
            NSString *sessionDir = toNSString(configured);
            [[NSFileManager defaultManager] createDirectoryAtPath:sessionDir
                                      withIntermediateDirectories:YES
                                                       attributes:nil
                                                            error:nil];
            return sessionDir;
        }

        NSString *cacheRoot = runtimeCacheRoot();
        NSString *sessionUuid = toNSString(sessionUuidValue());
        if ([sessionUuid length] == 0) {
            sessionUuid = [[NSUUID UUID] UUIDString];
        }
        NSString *sessionDir = [[cacheRoot stringByAppendingPathComponent:@"sessions"] stringByAppendingPathComponent:sessionUuid];
        [[NSFileManager defaultManager] createDirectoryAtPath:sessionDir
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        return sessionDir;
    }
}

NSString *runtimeInventoryDir()
{
    @autoreleasepool {
        NSString *runtimeDir = [runtimeSessionDir() stringByAppendingPathComponent:@"runtime"];
        [[NSFileManager defaultManager] createDirectoryAtPath:runtimeDir
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        return runtimeDir;
    }
}

NSString *bundleExecutableHash()
{
    @autoreleasepool {
        NSString *executablePath = [[NSBundle mainBundle] executablePath];
        if (executablePath == nil) {
            return @"";
        }

        NSData *data = [NSData dataWithContentsOfFile:executablePath];
        if (data == nil) {
            return @"";
        }

        unsigned char digest[CC_SHA256_DIGEST_LENGTH];
        CC_SHA256([data bytes], static_cast<CC_LONG>([data length]), digest);
        NSMutableString *hash = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
        for (int index = 0; index < CC_SHA256_DIGEST_LENGTH; ++index) {
            [hash appendFormat:@"%02x", digest[index]];
        }
        return hash;
    }
}

QString normalizeMenuText(const QString &text)
{
    QString normalized = text;
    normalized.replace(QChar('&'), QString());
    normalized.replace(QString::fromUtf8("…"), QStringLiteral("..."));

    QString cleaned;
    cleaned.reserve(normalized.size());
    for (QChar ch : normalized) {
        if (ch.category() == QChar::Other_Format || ch.unicode() == 0xFEFF) {
            continue;
        }
        cleaned.append(ch);
    }

    return cleaned.simplified();
}

QString lookupDynamicMenuTranslation(const QString &lang, const QString &sourceText)
{
    const QString source = normalizeMenuText(sourceText);
    if (source.isEmpty()) {
        return QString();
    }

    const QRegularExpression copyLayerPattern(QStringLiteral("^Copy\\s+([0-9]+)\\s+Layers?$"));
    const QRegularExpressionMatch copyLayerMatch = copyLayerPattern.match(source);
    if (copyLayerMatch.hasMatch()) {
        const QString count = copyLayerMatch.captured(1);
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("复制 %1 个图层").arg(count);
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("複製 %1 個圖層").arg(count);
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("%1 個のレイヤーをコピー").arg(count);
        }
    }

    const QRegularExpression rigControlPattern(QStringLiteral("^Rig Control\\s+([0-9]+)(\\.\\.\\.)?$"));
    const QRegularExpressionMatch rigControlMatch = rigControlPattern.match(source);
    if (rigControlMatch.hasMatch()) {
        const QString suffix = rigControlMatch.captured(2);
        const QString count = rigControlMatch.captured(1);
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("绑定控制 %1%2").arg(count, suffix);
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("綁定控制 %1%2").arg(count, suffix);
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("リグ制御 %1%2").arg(count, suffix);
        }
    }

    const QRegularExpression addKeyframePattern(QStringLiteral("^Add Keyframe on frame\\s+([0-9]+)$"));
    const QRegularExpressionMatch addKeyframeMatch = addKeyframePattern.match(source);
    if (addKeyframeMatch.hasMatch()) {
        const QString frame = addKeyframeMatch.captured(1);
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("在第 %1 帧添加关键帧").arg(frame);
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("在第 %1 幀新增關鍵幀").arg(frame);
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("フレーム %1 にキーフレームを追加").arg(frame);
        }
    }

    const QRegularExpression selectedCountPattern(QStringLiteral("^([0-9]+)\\s+selected$"));
    const QRegularExpressionMatch selectedCountMatch = selectedCountPattern.match(source);
    if (selectedCountMatch.hasMatch()) {
        const QString count = selectedCountMatch.captured(1);
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("已选择 %1 个").arg(count);
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("已選取 %1 個").arg(count);
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("%1 個を選択中").arg(count);
        }
    }

    if (source == QStringLiteral("Rename...")) {
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("重命名...");
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("重新命名...");
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("名前変更...");
        }
    }

    if (source.startsWith(QStringLiteral("Reveal Composition in Assets Wind"))) {
        if (lang == QStringLiteral("zh-Hans")) {
            return QStringLiteral("在素材窗口中显示合成");
        }
        if (lang == QStringLiteral("zh-Hant")) {
            return QStringLiteral("在素材視窗中顯示合成");
        }
        if (lang == QStringLiteral("ja_JP")) {
            return QStringLiteral("アセットウィンドウでコンポジションを表示");
        }
    }

    return QString();
}

void rebuildTranslationCache(const QString &lang)
{
    gTranslationBySource.clear();
    gTranslationCacheLang.clear();

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return;
    }

    for (int index = 0; index < count; ++index) {
        const QString source = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        const QString translation = QString::fromUtf8(entries[index].translation);
        if (!source.isEmpty() && !translation.isEmpty()) {
            gTranslationBySource.insert(source, translation);
        }
    }

    gTranslationCacheLang = lang;
}

QString lookupEmbeddedTranslation(const QString &lang, const QString &sourceText)
{
    const QString normalizedSource = normalizeMenuText(sourceText);
    if (normalizedSource.isEmpty()) {
        return QString();
    }

    if (gTranslationCacheLang == lang && !gTranslationBySource.isEmpty()) {
        const auto cached = gTranslationBySource.constFind(normalizedSource);
        if (cached != gTranslationBySource.constEnd()) {
            return cached.value();
        }
        if (normalizedSource.endsWith(QStringLiteral(":"))) {
            const QString bareSource = normalizeMenuText(normalizedSource.left(normalizedSource.size() - 1));
            const auto bareCached = gTranslationBySource.constFind(bareSource);
            if (bareCached != gTranslationBySource.constEnd()) {
                return bareCached.value() + QStringLiteral(":");
            }
        }
        return lookupDynamicMenuTranslation(lang, normalizedSource);
    }

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return QString();
    }

    for (int index = 0; index < count; ++index) {
        const QString candidate = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        if (candidate == normalizedSource) {
            return QString::fromUtf8(entries[index].translation);
        }
    }

    if (normalizedSource.endsWith(QStringLiteral(":"))) {
        const QString bareSource = normalizeMenuText(normalizedSource.left(normalizedSource.size() - 1));
        for (int index = 0; index < count; ++index) {
            const QString candidate = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
            if (candidate == bareSource) {
                return QString::fromUtf8(entries[index].translation) + QStringLiteral(":");
            }
        }
    }

    return lookupDynamicMenuTranslation(lang, normalizedSource);
}

NSString *toNSString(const QString &value)
{
    const QByteArray utf8 = value.toUtf8();
    return [NSString stringWithUTF8String:utf8.constData()];
}

NSString *runtimeMenuInventoryPath(const QString &lang)
{
    @autoreleasepool {
        NSString *runtimeDir = runtimeInventoryDir();
        NSString *fileName = [NSString stringWithFormat:@"%s-injector-inventory.json", lang.toUtf8().constData()];
        return [runtimeDir stringByAppendingPathComponent:fileName];
    }
}

id serializeQtAction(QAction *action);
id serializeWidget(QWidget *widget);

id serializeQtMenu(QMenu *menu)
{
    if (menu == nullptr) {
        return [NSNull null];
    }

    NSMutableArray *items = [NSMutableArray array];
    for (QAction *action : menu->actions()) {
        [items addObject:serializeQtAction(action)];
    }

    return @{
        @"title" : toNSString(menu->title()),
        @"items" : items,
    };
}

id serializeQtAction(QAction *action)
{
    if (action == nullptr) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"text"] = toNSString(action->text());
    payload[@"enabled"] = @(action->isEnabled());
    payload[@"separator"] = @(action->isSeparator());

    QMenu *submenu = action->menu();
    if (submenu != nullptr) {
        payload[@"submenu"] = serializeQtMenu(submenu);
    }

    return payload;
}

bool addStringValue(NSMutableDictionary *strings, NSString *key, const QString &value)
{
    const QString normalized = normalizeMenuText(value);
    if (normalized.isEmpty()) {
        return false;
    }

    strings[key] = toNSString(normalized);
    return true;
}

void addWidgetPropertyString(NSMutableDictionary *strings, QWidget *widget, const char *propertyName)
{
    const QVariant propertyValue = widget->property(propertyName);
    if (!propertyValue.isValid()) {
        return;
    }

    const QString value = normalizeMenuText(propertyValue.toString());
    if (value.isEmpty()) {
        return;
    }

    strings[[NSString stringWithUTF8String:propertyName]] = toNSString(value);
}

NSArray *widgetParentChain(QWidget *widget)
{
    NSMutableArray *chain = [NSMutableArray array];
    QObject *parent = widget != nullptr ? widget->parent() : nullptr;
    while (parent != nullptr && [chain count] < 12) {
        NSMutableDictionary *entry = [NSMutableDictionary dictionary];
        entry[@"className"] = [NSString stringWithUTF8String:parent->metaObject()->className()];
        if (!parent->objectName().isEmpty()) {
            entry[@"objectName"] = toNSString(parent->objectName());
        }
        [chain addObject:entry];
        parent = parent->parent();
    }
    return chain;
}

NSDictionary *widgetGlobalGeometry(QWidget *widget)
{
    const QPoint topLeft = widget->mapToGlobal(QPoint(0, 0));
    const QRect rect = widget->rect();
    return @{
        @"x" : @(topLeft.x()),
        @"y" : @(topLeft.y()),
        @"w" : @(rect.width()),
        @"h" : @(rect.height()),
    };
}

NSArray *widgetDynamicProperties(QWidget *widget)
{
    NSMutableArray *properties = [NSMutableArray array];
    for (const QByteArray &name : widget->dynamicPropertyNames()) {
        const QVariant value = widget->property(name.constData());
        NSMutableDictionary *entry = [NSMutableDictionary dictionary];
        entry[@"name"] = [NSString stringWithUTF8String:name.constData()];
        if (value.isValid()) {
            entry[@"value"] = toNSString(normalizeMenuText(value.toString()));
        }
        [properties addObject:entry];
    }
    return properties;
}

bool shouldDumpItemModels()
{
    const QString enabled = readEnvVar("CAVALRY_I18N_DUMP_ITEM_MODELS").trimmed().toLower();
    return enabled == QStringLiteral("1") || enabled == QStringLiteral("true") || enabled == QStringLiteral("yes");
}

NSString *variantTypeName(const QVariant &value)
{
    const char *name = value.metaType().name();
    if (name == nullptr) {
        name = value.typeName();
    }
    return name != nullptr ? [NSString stringWithUTF8String:name] : @"";
}

id serializeModelVariant(const QVariant &value)
{
    if (!value.isValid()) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"type"] = variantTypeName(value);
    payload[@"null"] = @(value.isNull());

    const QString text = normalizeMenuText(value.toString());
    if (!text.isEmpty()) {
        payload[@"text"] = toNSString(text);
    }

    return payload;
}

NSArray *modelRoleSpecs(QAbstractItemModel *model)
{
    NSMutableArray *roles = [NSMutableArray array];
    const QHash<int, QByteArray> roleNames = model != nullptr ? model->roleNames() : QHash<int, QByteArray>();
    auto addRole = ^(int role, NSString *fallbackName) {
        NSString *name = fallbackName;
        const auto found = roleNames.constFind(role);
        if (found != roleNames.constEnd() && !found.value().isEmpty()) {
            name = [NSString stringWithUTF8String:found.value().constData()];
        }
        [roles addObject:@{ @"role" : @(role), @"name" : name }];
    };

    addRole(Qt::DisplayRole, @"DisplayRole");
    addRole(Qt::DecorationRole, @"DecorationRole");
    addRole(Qt::EditRole, @"EditRole");
    addRole(Qt::ToolTipRole, @"ToolTipRole");
    addRole(Qt::StatusTipRole, @"StatusTipRole");
    addRole(Qt::WhatsThisRole, @"WhatsThisRole");
    addRole(Qt::AccessibleTextRole, @"AccessibleTextRole");
    addRole(Qt::AccessibleDescriptionRole, @"AccessibleDescriptionRole");
    addRole(Qt::CheckStateRole, @"CheckStateRole");

    for (int offset = 0; offset < 64; ++offset) {
        addRole(Qt::UserRole + offset, toNSString(QStringLiteral("UserRole+%1").arg(offset)));
    }

    return roles;
}

NSArray *serializeModelRows(QAbstractItemView *view, QAbstractItemModel *model, const QModelIndex &parent, int depth)
{
    NSMutableArray *rows = [NSMutableArray array];
    if (model == nullptr || depth > 2) {
        return rows;
    }

    const int rowCount = qMin(model->rowCount(parent), 80);
    const int columnCount = qMin(qMax(model->columnCount(parent), 1), 8);
    NSArray *roleSpecs = modelRoleSpecs(model);

    for (int row = 0; row < rowCount; ++row) {
        NSMutableDictionary *rowPayload = [NSMutableDictionary dictionary];
        rowPayload[@"row"] = @(row);
        rowPayload[@"depth"] = @(depth);

        NSMutableArray *columns = [NSMutableArray array];
        for (int column = 0; column < columnCount; ++column) {
            const QModelIndex index = model->index(row, column, parent);
            if (!index.isValid()) {
                continue;
            }

            NSMutableDictionary *columnPayload = [NSMutableDictionary dictionary];
            columnPayload[@"column"] = @(column);

            const QRect visualRect = view != nullptr ? view->visualRect(index) : QRect();
            if (visualRect.isValid()) {
                columnPayload[@"visualRect"] = @{
                    @"x" : @(visualRect.x()),
                    @"y" : @(visualRect.y()),
                    @"w" : @(visualRect.width()),
                    @"h" : @(visualRect.height()),
                };
            }

            NSMutableArray *roleValues = [NSMutableArray array];
            for (NSDictionary *roleSpec in roleSpecs) {
                const int role = [roleSpec[@"role"] intValue];
                const QVariant value = model->data(index, role);
                if (!value.isValid()) {
                    continue;
                }

                NSMutableDictionary *rolePayload = [NSMutableDictionary dictionaryWithDictionary:roleSpec];
                rolePayload[@"value"] = serializeModelVariant(value);
                [roleValues addObject:rolePayload];
            }
            if ([roleValues count] > 0) {
                columnPayload[@"roles"] = roleValues;
            }

            const int childRows = model->rowCount(index);
            if (childRows > 0) {
                columnPayload[@"children"] = serializeModelRows(view, model, index, depth + 1);
            }

            [columns addObject:columnPayload];
        }

        if ([columns count] > 0) {
            rowPayload[@"columns"] = columns;
            [rows addObject:rowPayload];
        }
    }

    return rows;
}

id serializeItemViewModel(QAbstractItemView *view)
{
    if (view == nullptr || !view->isVisible()) {
        return [NSNull null];
    }

    QAbstractItemModel *model = view->model();
    if (model == nullptr) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"className"] = [NSString stringWithUTF8String:view->metaObject()->className()];
    payload[@"modelClassName"] = [NSString stringWithUTF8String:model->metaObject()->className()];
    payload[@"geometry"] = widgetGlobalGeometry(view);
    payload[@"parentChain"] = widgetParentChain(view);
    payload[@"rootRowCount"] = @(model->rowCount());
    payload[@"rootColumnCount"] = @(model->columnCount());
    if (!view->objectName().isEmpty()) {
        payload[@"objectName"] = toNSString(view->objectName());
    }
    if (!model->objectName().isEmpty()) {
        payload[@"modelObjectName"] = toNSString(model->objectName());
    }

    NSArray *dynamicProperties = widgetDynamicProperties(view);
    if ([dynamicProperties count] > 0) {
        payload[@"dynamicProperties"] = dynamicProperties;
    }

    NSMutableDictionary *strings = [NSMutableDictionary dictionary];
    addStringValue(strings, @"windowTitle", view->windowTitle());
    addStringValue(strings, @"toolTip", view->toolTip());
    addStringValue(strings, @"statusTip", view->statusTip());
    addStringValue(strings, @"whatsThis", view->whatsThis());
    if ([strings count] > 0) {
        payload[@"strings"] = strings;
    }

    payload[@"rows"] = serializeModelRows(view, model, QModelIndex(), 0);
    return payload;
}

bool shouldKeepDiagnosticWidget(QWidget *widget)
{
    const QString className = QString::fromLatin1(widget->metaObject()->className());
    if (className.contains(QStringLiteral("Attribute"), Qt::CaseInsensitive) ||
        className.contains(QStringLiteral("Editable"), Qt::CaseInsensitive) ||
        className.contains(QStringLiteral("LineEdit"), Qt::CaseInsensitive) ||
        className.contains(QStringLiteral("Rollover"), Qt::CaseInsensitive) ||
        className.contains(QStringLiteral("RowWidget"), Qt::CaseInsensitive)) {
        return true;
    }

    QObject *parent = widget->parent();
    while (parent != nullptr) {
        const QString parentClassName = QString::fromLatin1(parent->metaObject()->className());
        if (parentClassName.contains(QStringLiteral("Attribute"), Qt::CaseInsensitive)) {
            return true;
        }
        parent = parent->parent();
    }

    return false;
}

bool hasAncestorClass(QObject *object, const char *className)
{
    QObject *parent = object != nullptr ? object->parent() : nullptr;
    while (parent != nullptr) {
        if (strcmp(parent->metaObject()->className(), className) == 0) {
            return true;
        }
        parent = parent->parent();
    }
    return false;
}

void pruneQuickAddEmptyItems(QListWidget *listWidget)
{
    if (listWidget == nullptr || !hasAncestorClass(listWidget, "QuickAddWindow")) {
        return;
    }

    for (int row = listWidget->count() - 1; row >= 0; --row) {
        QListWidgetItem *item = listWidget->item(row);
        if (item == nullptr || !normalizeMenuText(item->text()).isEmpty()) {
            continue;
        }
        delete listWidget->takeItem(row);
    }
}

id serializeWidgetAtPoint(NSString *name, const QPoint &point)
{
    QWidget *widget = QApplication::widgetAt(point);
    if (widget == nullptr) {
        return @{
            @"name" : name,
            @"point" : @{
                @"x" : @(point.x()),
                @"y" : @(point.y()),
            },
            @"hit" : [NSNull null],
        };
    }

    NSMutableDictionary *hit = [NSMutableDictionary dictionary];
    hit[@"className"] = [NSString stringWithUTF8String:widget->metaObject()->className()];
    hit[@"geometry"] = widgetGlobalGeometry(widget);
    hit[@"parentChain"] = widgetParentChain(widget);
    if (!widget->objectName().isEmpty()) {
        hit[@"objectName"] = toNSString(widget->objectName());
    }
    NSArray *dynamicProperties = widgetDynamicProperties(widget);
    if ([dynamicProperties count] > 0) {
        hit[@"dynamicProperties"] = dynamicProperties;
    }

    NSMutableDictionary *strings = [NSMutableDictionary dictionary];
    addStringValue(strings, @"windowTitle", widget->windowTitle());
    addStringValue(strings, @"toolTip", widget->toolTip());
    addStringValue(strings, @"statusTip", widget->statusTip());
    addStringValue(strings, @"whatsThis", widget->whatsThis());
    addWidgetPropertyString(strings, widget, "text");
    addWidgetPropertyString(strings, widget, "title");
    addWidgetPropertyString(strings, widget, "placeholderText");
    addWidgetPropertyString(strings, widget, "currentText");
    if ([strings count] > 0) {
        hit[@"strings"] = strings;
    }

    return @{
        @"name" : name,
        @"point" : @{
            @"x" : @(point.x()),
            @"y" : @(point.y()),
        },
        @"hit" : hit,
    };
}

id serializeWidget(QWidget *widget)
{
    if (widget == nullptr || !widget->isVisible()) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"className"] = [NSString stringWithUTF8String:widget->metaObject()->className()];
    payload[@"geometry"] = widgetGlobalGeometry(widget);
    payload[@"parentChain"] = widgetParentChain(widget);
    if (!widget->objectName().isEmpty()) {
        payload[@"objectName"] = toNSString(widget->objectName());
    }

    NSArray *dynamicProperties = widgetDynamicProperties(widget);
    if ([dynamicProperties count] > 0) {
        payload[@"dynamicProperties"] = dynamicProperties;
    }

    NSMutableDictionary *strings = [NSMutableDictionary dictionary];
    addStringValue(strings, @"windowTitle", widget->windowTitle());
    addStringValue(strings, @"toolTip", widget->toolTip());
    addStringValue(strings, @"statusTip", widget->statusTip());
    addStringValue(strings, @"whatsThis", widget->whatsThis());
    addWidgetPropertyString(strings, widget, "text");
    addWidgetPropertyString(strings, widget, "title");
    addWidgetPropertyString(strings, widget, "placeholderText");
    addWidgetPropertyString(strings, widget, "currentText");

    if ([strings count] > 0) {
        payload[@"strings"] = strings;
    }

    QTabBar *tabBar = qobject_cast<QTabBar *>(widget);
    if (tabBar != nullptr && tabBar->count() > 0) {
        NSMutableArray *tabTexts = [NSMutableArray array];
        for (int index = 0; index < tabBar->count(); ++index) {
            const QString tabText = normalizeMenuText(tabBar->tabText(index));
            if (!tabText.isEmpty()) {
                [tabTexts addObject:toNSString(tabText)];
            }
        }
        if ([tabTexts count] > 0) {
            payload[@"tabTexts"] = tabTexts;
        }
    }

    NSMutableArray *actionTexts = [NSMutableArray array];
    for (QAction *action : widget->actions()) {
        if (action != nullptr) {
            const QString actionText = normalizeMenuText(action->text());
            if (!actionText.isEmpty()) {
                [actionTexts addObject:toNSString(actionText)];
            }
        }
    }
    if ([actionTexts count] > 0) {
        payload[@"actionTexts"] = actionTexts;
    }

    if (payload[@"strings"] == nil && payload[@"tabTexts"] == nil && payload[@"actionTexts"] == nil &&
        !shouldKeepDiagnosticWidget(widget)) {
        return [NSNull null];
    }

    return payload;
}

bool dumpQtMenuInventory(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return false;
    }

    NSMutableArray *menuBars = [NSMutableArray array];
    NSMutableArray *widgetTexts = [NSMutableArray array];
    NSMutableArray *itemModels = [NSMutableArray array];
    const bool dumpItemModels = shouldDumpItemModels();
    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget);
        if (menuBar != nullptr && !menuBar->actions().isEmpty()) {
            NSMutableArray *items = [NSMutableArray array];
            for (QAction *action : menuBar->actions()) {
                [items addObject:serializeQtAction(action)];
            }

            [menuBars addObject:@{
                @"items" : items,
            }];
        }

        id serializedWidget = serializeWidget(widget);
        if (serializedWidget != [NSNull null]) {
            [widgetTexts addObject:serializedWidget];
        }

        if (dumpItemModels) {
            QAbstractItemView *itemView = qobject_cast<QAbstractItemView *>(widget);
            id serializedModel = serializeItemViewModel(itemView);
            if (serializedModel != [NSNull null]) {
                [itemModels addObject:serializedModel];
            }
        }
    }

    if ([menuBars count] == 0 && [widgetTexts count] == 0 && [itemModels count] == 0) {
        fprintf(stderr,
                "[cavalry-i18n] menu inventory export deferred: no populated Qt menu bar or visible widget text yet\n");
        return false;
    }

    NSError *jsonError = nil;
    NSString *inventoryPath = runtimeMenuInventoryPath(lang);
    NSData *payload = [NSJSONSerialization dataWithJSONObject:@{
        @"formatVersion" : @3,
        @"language" : toNSString(lang),
        @"source" : @"live-injector",
        @"inventoryPath" : inventoryPath,
        @"capture" : @{
            @"pid" : @([[NSProcessInfo processInfo] processIdentifier]),
            @"bundleHash" : bundleExecutableHash(),
            @"sessionUuid" : toNSString(sessionUuidValue()),
            @"wallclockUtc" : toNSString(QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)),
            @"source" : @"live-injector",
        },
        @"menuBars" : menuBars,
        @"widgetTexts" : widgetTexts,
        @"itemModels" : itemModels,
        @"diagnostics" : @{
            @"refreshCount" : @(gRefreshCount),
            @"menuHookCount" : @(gHookedMenus.size()),
            @"dirtyEnqueueCount" : @(gDirtyEnqueueCount),
            @"dirtyDrainCount" : @(gDirtyDrainCount),
            @"dirtyObjectTranslateCount" : @(gDirtyObjectTranslateCount),
            @"cursorWidget" : serializeWidgetAtPoint(@"cursor", QCursor::pos()),
        },
    }
                                                       options:NSJSONWritingPrettyPrinted
                                                          error:&jsonError];
    if (payload == nil) {
        fprintf(stderr,
                "[cavalry-i18n] failed to serialize runtime menu inventory: %s\n",
                jsonError != nil ? [[jsonError localizedDescription] UTF8String] : "unknown error");
        return false;
    }

    NSError *writeError = nil;
    const bool wrote = [payload writeToFile:inventoryPath
                                    options:NSDataWritingAtomic
                                      error:&writeError];
    if (wrote) {
        fprintf(stderr,
                "[cavalry-i18n] exported runtime menu inventory -> %s\n",
                [inventoryPath UTF8String]);
    } else {
        fprintf(stderr,
                "[cavalry-i18n] failed to write runtime menu inventory: %s (%s)\n",
                [inventoryPath UTF8String],
                writeError != nil ? [[writeError localizedDescription] UTF8String] : "unknown error");
    }
    return wrote;
}

void translateQtAction(QAction *action, const QString &lang);
void hookQtMenu(QMenu *menu, const QString &lang);
void hookQtMenus(const QString &lang);

void translateQtMenu(QMenu *menu, const QString &lang)
{
    if (menu == nullptr) {
        return;
    }

    const QString title = menu->title();
    const QString translatedTitle = lookupEmbeddedTranslation(lang, title);
    if (!translatedTitle.isEmpty() && translatedTitle != title) {
        menu->setTitle(translatedTitle);
    }

    for (QAction *action : menu->actions()) {
        translateQtAction(action, lang);
    }
}

void translateQtAction(QAction *action, const QString &lang)
{
    if (action == nullptr) {
        return;
    }

    QString translated = lookupEmbeddedTranslation(lang, action->text());
    if (!translated.isEmpty() && translated != action->text()) {
        action->setText(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->iconText());
    if (!translated.isEmpty() && translated != action->iconText()) {
        action->setIconText(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->toolTip());
    if (!translated.isEmpty() && translated != action->toolTip()) {
        action->setToolTip(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->statusTip());
    if (!translated.isEmpty() && translated != action->statusTip()) {
        action->setStatusTip(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->whatsThis());
    if (!translated.isEmpty() && translated != action->whatsThis()) {
        action->setWhatsThis(translated);
    }

    QMenu *submenu = action->menu();
    hookQtMenu(submenu, lang);
    translateQtMenu(submenu, lang);
}

bool translateQtMenuBar(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return false;
    }

    bool foundMenuSurface = false;
    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget);
        if (menuBar == nullptr) {
            continue;
        }

        const auto actions = menuBar->actions();
        if (!actions.isEmpty()) {
            foundMenuSurface = true;
        }

        for (QAction *action : actions) {
            translateQtAction(action, lang);
        }
    }

    return foundMenuSurface;
}

void translateNativeMenu(NSMenu *menu, const QString &lang)
{
    if (menu == nil) {
        return;
    }

    for (NSMenuItem *item in [menu itemArray]) {
        const QString title = QString::fromUtf8([[item title] UTF8String]);
        const QString translated = lookupEmbeddedTranslation(lang, title);
        if (!translated.isEmpty() && translated != title) {
            const QByteArray utf8 = translated.toUtf8();
            [item setTitle:[NSString stringWithUTF8String:utf8.constData()]];
        }

        translateNativeMenu([item submenu], lang);
    }
}

void refreshNativeMenuBar(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    @autoreleasepool {
        translateNativeMenu([NSApp mainMenu], lang);
    }
}

void translateMenuBeforeFirstPaint(QMenu *menu, const QString &lang, bool syncNativeMenu)
{
    if (menu == nullptr || lang.isEmpty()) {
        return;
    }

    hookQtMenu(menu, lang);
    translateQtMenu(menu, lang);
    if (syncNativeMenu) {
        refreshNativeMenuBar(lang);
    }
}

void hookQtMenu(QMenu *menu, const QString &lang)
{
    if (menu == nullptr || lang.isEmpty() || gHookedMenus.contains(menu)) {
        return;
    }

    gHookedMenus.insert(menu);
    QPointer<QMenu> guardedMenu(menu);
    QObject::connect(
        menu,
        &QObject::destroyed,
        menu,
        [menu]() {
            gHookedMenus.remove(menu);
        }
    );
    QObject::connect(
        menu,
        &QMenu::aboutToShow,
        menu,
        [guardedMenu, lang]() {
            if (guardedMenu.isNull()) {
                return;
            }
            // Defer translation to next event loop iteration in COMMON modes.
            // dispatch_async(main_queue) does NOT run during menu tracking
            // (NSRunLoop is in NSEventTrackingRunLoopMode), so use
            // CFRunLoopPerformBlock with kCFRunLoopCommonModes to ensure
            // the translation block executes while the menu is visible.
            CFRunLoopPerformBlock(CFRunLoopGetMain(), kCFRunLoopCommonModes, ^{
                if (guardedMenu.isNull()) {
                    return;
                }
                translateQtMenu(guardedMenu, lang);
                for (QAction *action : guardedMenu->actions()) {
                    if (action != nullptr) {
                        translateQtAction(action, lang);
                    }
                }
                refreshNativeMenuBar(lang);
            });
            CFRunLoopWakeUp(CFRunLoopGetMain());
        }
    );
}

void hookQtMenus(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr || lang.isEmpty()) {
        return;
    }

    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        if (QMenu *menu = qobject_cast<QMenu *>(widget)) {
            hookQtMenu(menu, lang);
        }
        if (QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget)) {
            for (QAction *action : menuBar->actions()) {
                hookQtMenu(action != nullptr ? action->menu() : nullptr, lang);
            }
        }
    }
}

QString translatedCompoundWidgetText(const QString &lang, const QString &sourceText);
QString translatedGeneratedLayerName(const QString &lang, const QString &sourceText);
QString translatedMixedNoPrefixText(const QString &lang, const QString &sourceText);

QString translatedWidgetText(const QString &lang, const QString &sourceText)
{
    const QString translated = translatedCompoundWidgetText(lang, sourceText);
    if (translated.isEmpty() || translated == sourceText) {
        const QString noPrefixTranslation = translatedMixedNoPrefixText(lang, sourceText);
        if (!noPrefixTranslation.isEmpty()) {
            return noPrefixTranslation;
        }

        QRegularExpressionMatch match = QRegularExpression(QStringLiteral("^(.*?)(\\s+[0-9]+)$")).match(sourceText);
        if (!match.hasMatch()) {
            return QString();
        }

        const QString baseTranslation = translatedCompoundWidgetText(lang, match.captured(1).trimmed());
        if (baseTranslation.isEmpty() || baseTranslation == match.captured(1).trimmed()) {
            return QString();
        }
        return baseTranslation + match.captured(2);
    }
    return translated;
}

QString translatedCompoundWidgetText(const QString &lang, const QString &sourceText)
{
    const QString translated = lookupEmbeddedTranslation(lang, sourceText);
    if (!translated.isEmpty() && translated != sourceText) {
        return translated;
    }

    const QString generatedLayerName = translatedGeneratedLayerName(lang, sourceText);
    if (!generatedLayerName.isEmpty() && generatedLayerName != sourceText) {
        return generatedLayerName;
    }

    if (!sourceText.contains(QChar('\n'))) {
        return QString();
    }

    const QStringList lines = sourceText.split(QChar('\n'));
    QStringList translatedLines;
    translatedLines.reserve(lines.size());

    int translatedLineCount = 0;
    for (const QString &line : lines) {
        const QString translatedLine = lookupEmbeddedTranslation(lang, line);
        if (!translatedLine.isEmpty() && translatedLine != line) {
            translatedLines.append(translatedLine);
            ++translatedLineCount;
            continue;
        }
        translatedLines.append(line);
    }

    if (translatedLineCount == 0) {
        return QString();
    }

    return translatedLines.join(QChar('\n'));
}

QString translatedGeneratedLayerName(const QString &lang, const QString &sourceText)
{
    static const QString kShapeSuffix = QStringLiteral(" Shape");
    const QString source = normalizeMenuText(sourceText);
    if (!source.endsWith(kShapeSuffix)) {
        return QString();
    }

    const QString base = source.left(source.size() - kShapeSuffix.size()).trimmed();
    if (base.isEmpty()) {
        return QString();
    }

    const QString baseTranslation = lookupEmbeddedTranslation(lang, base);
    const QString shapeTranslation = lookupEmbeddedTranslation(lang, QStringLiteral("Shape"));
    if (baseTranslation.isEmpty() || shapeTranslation.isEmpty() ||
        baseTranslation == base || shapeTranslation == QStringLiteral("Shape")) {
        return QString();
    }

    return baseTranslation + shapeTranslation;
}

QString translatedMixedNoPrefixText(const QString &lang, const QString &sourceText)
{
    const QString source = normalizeMenuText(sourceText);
    if (!source.startsWith(QStringLiteral("No "))) {
        return QString();
    }

    const QString suffix = normalizeMenuText(source.mid(3));
    if (suffix.isEmpty()) {
        return QString();
    }

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return QString();
    }

    for (int index = 0; index < count; ++index) {
        const QString englishSource = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        if (!englishSource.startsWith(QStringLiteral("No "))) {
            continue;
        }

        const QString englishSuffix = normalizeMenuText(englishSource.mid(3));
        const QString suffixTranslation = normalizeMenuText(lookupEmbeddedTranslation(lang, englishSuffix));
        if (!suffixTranslation.isEmpty() && suffixTranslation == suffix) {
            return QString::fromUtf8(entries[index].translation);
        }
    }

    return QString();
}

void translateListWidgetItems(QListWidget *listWidget, const QString &lang)
{
    if (listWidget == nullptr || lang.isEmpty()) {
        return;
    }
    pruneQuickAddEmptyItems(listWidget);
    for (int row = 0; row < listWidget->count(); ++row) {
        QListWidgetItem *item = listWidget->item(row);
        if (item == nullptr) {
            continue;
        }
        const QString source = item->text();
        if (shouldPreserveModelBackedItemText(listWidget, source)) {
            continue;
        }
        const QString translated = translatedWidgetText(lang, source);
        if (!translated.isEmpty()) {
            item->setText(translated);
        }
    }
}

void translateTreeWidgetItem(QTreeWidget *owner, QTreeWidgetItem *item, const QString &lang)
{
    if (item == nullptr || lang.isEmpty()) {
        return;
    }
    for (int column = 0; column < item->columnCount(); ++column) {
        const QString source = item->text(column);
        if (shouldPreserveModelBackedItemText(owner, source)) {
            continue;
        }
        const QString translated = translatedWidgetText(lang, source);
        if (!translated.isEmpty()) {
            item->setText(column, translated);
        }
    }
    for (int index = 0; index < item->childCount(); ++index) {
        translateTreeWidgetItem(owner, item->child(index), lang);
    }
}

void translateTableWidgetItems(QTableWidget *tableWidget, const QString &lang)
{
    if (tableWidget == nullptr || lang.isEmpty()) {
        return;
    }
    for (int row = 0; row < tableWidget->rowCount(); ++row) {
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *item = tableWidget->item(row, column);
            if (item == nullptr) {
                continue;
            }
            const QString translated = translatedWidgetText(lang, item->text());
            if (!translated.isEmpty()) {
                item->setText(translated);
            }
        }
    }
}

QString translatedLineEditValue(const QString &lang, const QString &sourceText)
{
    QString translated = translatedWidgetText(lang, sourceText);
    if (!translated.isEmpty()) {
        return translated;
    }

    QRegularExpressionMatch match = QRegularExpression(QStringLiteral("^(.*?)(\\s+[0-9]+)$")).match(sourceText);
    if (!match.hasMatch()) {
        return QString();
    }

    const QString baseTranslation = translatedWidgetText(lang, match.captured(1).trimmed());
    if (baseTranslation.isEmpty()) {
        return QString();
    }
    return baseTranslation + match.captured(2);
}

void translateLineEditDisplayText(QLineEdit *lineEdit, const QString &lang)
{
    if (lineEdit == nullptr || lang.isEmpty()) {
        return;
    }

    QString translated = translatedLineEditValue(lang, lineEdit->text());
    if (!translated.isEmpty()) {
        QSignalBlocker blocker(lineEdit);
        lineEdit->setText(translated);
    }

    translated = translatedWidgetText(lang, lineEdit->placeholderText());
    if (!translated.isEmpty()) {
        lineEdit->setPlaceholderText(translated);
    }
}

void hookLineEditTextChanges(QLineEdit *lineEdit, const QString &lang)
{
    if (lineEdit == nullptr || lang.isEmpty() || gHookedLineEdits.contains(lineEdit)) {
        return;
    }

    gHookedLineEdits.insert(lineEdit);
    QObject::connect(
        lineEdit,
        &QObject::destroyed,
        lineEdit,
        [lineEdit]() {
            gHookedLineEdits.remove(lineEdit);
        }
    );

    QPointer<QLineEdit> guardedLineEdit(lineEdit);
    QObject::connect(
        lineEdit,
        &QLineEdit::textChanged,
        lineEdit,
        [guardedLineEdit, lang](const QString &text) {
            if (guardedLineEdit.isNull() || text.isEmpty()) {
                return;
            }
            const QString translated = translatedLineEditValue(lang, text);
            if (translated.isEmpty() || guardedLineEdit->text() != text) {
                return;
            }

            QSignalBlocker blocker(guardedLineEdit.data());
            guardedLineEdit->setText(translated);
        }
    );

    translateLineEditDisplayText(lineEdit, lang);
}

void translateQtWidgetActions(QWidget *widget, const QString &lang, QSet<QAction *> &seen)
{
    if (widget == nullptr || lang.isEmpty()) {
        return;
    }

    for (QAction *action : widget->actions()) {
        if (action == nullptr || seen.contains(action)) {
            continue;
        }
        seen.insert(action);
        translateQtAction(action, lang);
    }
}

void translateQtWidgetTexts(QWidget *widget, const QString &lang, QSet<QAction *> &seenActions)
{
    if (widget == nullptr || lang.isEmpty()) {
        return;
    }

    QString translated = translatedWidgetText(lang, widget->windowTitle());
    if (!translated.isEmpty()) {
        widget->setWindowTitle(translated);
    }

    translated = translatedWidgetText(lang, widget->toolTip());
    if (!translated.isEmpty()) {
        widget->setToolTip(translated);
    }

    translated = translatedWidgetText(lang, widget->statusTip());
    if (!translated.isEmpty()) {
        widget->setStatusTip(translated);
    }

    translated = translatedWidgetText(lang, widget->whatsThis());
    if (!translated.isEmpty()) {
        widget->setWhatsThis(translated);
    }

    if (QLabel *label = qobject_cast<QLabel *>(widget)) {
        translated = translatedWidgetText(lang, label->text());
        if (!translated.isEmpty()) {
            label->setText(translated);
        }
    }

    if (QAbstractButton *button = qobject_cast<QAbstractButton *>(widget)) {
        translated = translatedWidgetText(lang, button->text());
        if (!translated.isEmpty()) {
            button->setText(translated);
        }
    }

    if (QGroupBox *groupBox = qobject_cast<QGroupBox *>(widget)) {
        translated = translatedWidgetText(lang, groupBox->title());
        if (!translated.isEmpty()) {
            groupBox->setTitle(translated);
        }
    }

    if (QLineEdit *lineEdit = qobject_cast<QLineEdit *>(widget)) {
        hookLineEditTextChanges(lineEdit, lang);
    }

    if (QComboBox *comboBox = qobject_cast<QComboBox *>(widget)) {
        for (int index = 0; index < comboBox->count(); ++index) {
            translated = translatedWidgetText(lang, comboBox->itemText(index));
            if (!translated.isEmpty()) {
                comboBox->setItemText(index, translated);
            }
        }
    }

    if (QTabBar *tabBar = qobject_cast<QTabBar *>(widget)) {
        for (int index = 0; index < tabBar->count(); ++index) {
            translated = translatedWidgetText(lang, tabBar->tabText(index));
            if (!translated.isEmpty()) {
                tabBar->setTabText(index, translated);
            }
        }
    }

    if (QTabWidget *tabWidget = qobject_cast<QTabWidget *>(widget)) {
        for (int index = 0; index < tabWidget->count(); ++index) {
            translated = translatedWidgetText(lang, tabWidget->tabText(index));
            if (!translated.isEmpty()) {
                tabWidget->setTabText(index, translated);
            }
        }
    }

    if (QStatusBar *statusBar = qobject_cast<QStatusBar *>(widget)) {
        translated = translatedWidgetText(lang, statusBar->currentMessage());
        if (!translated.isEmpty()) {
            statusBar->showMessage(translated);

        }
    }

    if (QDockWidget *dockWidget = qobject_cast<QDockWidget *>(widget)) {
        translated = translatedWidgetText(lang, dockWidget->windowTitle());
        if (!translated.isEmpty()) {
            dockWidget->setWindowTitle(translated);
        }
    }

    if (QToolBar *toolBar = qobject_cast<QToolBar *>(widget)) {
        translated = translatedWidgetText(lang, toolBar->windowTitle());
        if (!translated.isEmpty()) {
            toolBar->setWindowTitle(translated);
        }
        for (QAction *action : toolBar->actions()) {
            translateQtAction(action, lang);
        }
    }

    if (QToolButton *toolButton = qobject_cast<QToolButton *>(widget)) {
        translated = translatedWidgetText(lang, toolButton->text());
        if (!translated.isEmpty()) {
            toolButton->setText(translated);
        }
        translateQtAction(toolButton->defaultAction(), lang);
    }

    if (QDialogButtonBox *buttonBox = qobject_cast<QDialogButtonBox *>(widget)) {
        for (QAbstractButton *button : buttonBox->buttons()) {
            translated = translatedWidgetText(lang, button->text());
            if (!translated.isEmpty()) {
                button->setText(translated);
            }
        }
    }

    if (QSpinBox *spinBox = qobject_cast<QSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, spinBox->prefix());
        if (!translated.isEmpty()) {
            spinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, spinBox->suffix());
        if (!translated.isEmpty()) {
            spinBox->setSuffix(translated);
        }
    }

    if (QDoubleSpinBox *doubleSpinBox = qobject_cast<QDoubleSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, doubleSpinBox->prefix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, doubleSpinBox->suffix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setSuffix(translated);
        }
    }

    if (QProgressBar *progressBar = qobject_cast<QProgressBar *>(widget)) {
        translated = translatedWidgetText(lang, progressBar->format());
        if (!translated.isEmpty()) {
            progressBar->setFormat(translated);
        }
    }

    if (QListWidget *listWidget = qobject_cast<QListWidget *>(widget)) {
        translateListWidgetItems(listWidget, lang);
    }

    if (QTreeWidget *treeWidget = qobject_cast<QTreeWidget *>(widget)) {
        for (int column = 0; column < treeWidget->columnCount(); ++column) {
            QTreeWidgetItem *header = treeWidget->headerItem();
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text(column));
                if (!translated.isEmpty()) {
                    header->setText(column, translated);
                }
            }
        }
        for (int index = 0; index < treeWidget->topLevelItemCount(); ++index) {
            translateTreeWidgetItem(treeWidget, treeWidget->topLevelItem(index), lang);
        }
    }

    if (QTableWidget *tableWidget = qobject_cast<QTableWidget *>(widget)) {
        translateTableWidgetItems(tableWidget, lang);
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *header = tableWidget->horizontalHeaderItem(column);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
        for (int row = 0; row < tableWidget->rowCount(); ++row) {
            QTableWidgetItem *header = tableWidget->verticalHeaderItem(row);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
    }

    translateQtWidgetActions(widget, lang, seenActions);
}

void translateQtWidgets(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return;
    }

    const auto widgets = QApplication::allWidgets();
    QSet<QAction *> seenActions;
    for (QWidget *widget : widgets) {
        translateQtWidgetTexts(widget, lang, seenActions);
    }
}

void refreshQtUiTranslations(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    ++gRefreshCount;
    hookQtMenus(lang);
    translateQtMenuBar(lang);
    translateQtWidgets(lang);
    refreshNativeMenuBar(lang);
    dumpQtMenuInventory(lang);
}

void scheduleInteractiveRefresh(QString lang)
{
    if (lang.isEmpty() || gInteractiveRefreshScheduled) {
        return;
    }

    gInteractiveRefreshScheduled = true;
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(100) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            gInteractiveRefreshScheduled = false;
            refreshQtUiTranslations(lang);
        }
    );
}

void scheduleRefreshAttempts(QString lang)
{
    if (gRefreshScheduled || lang.isEmpty()) {
        return;
    }

    gRefreshScheduled = true;
    for (int i = 0; i < kWarmupRefreshAttempts; ++i) {
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(i * kRefreshDelayMs) * NSEC_PER_MSEC),
            dispatch_get_main_queue(),
            ^{
                refreshQtUiTranslations(lang);
            }
        );
    }
}

void translateRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty()) {
        return;
    }

    QSet<QAction *> seenActions;
    if (QAction *action = qobject_cast<QAction *>(object)) {
        translateQtAction(action, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QMenu *menu = qobject_cast<QMenu *>(object)) {
        hookQtMenu(menu, lang);
        translateQtMenu(menu, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QWidget *widget = qobject_cast<QWidget *>(object)) {
        translateQtWidgetTexts(widget, lang, seenActions);
        for (QWidget *child : widget->findChildren<QWidget *>(QString(), Qt::FindDirectChildrenOnly)) {
            translateQtWidgetTexts(child, lang, seenActions);
        }
        ++gDirtyObjectTranslateCount;
    }
}

void drainDirtyObjects(QString lang)
{
    int processed = 0;
    while (!gDirtyObjects.isEmpty() && processed < kDirtyDrainMaxObjects) {
        DirtyObject entry = gDirtyObjects.takeFirst();
        gDirtyObjectSet.remove(entry.key);
        if (!entry.object.isNull()) {
            translateRuntimeObject(entry.object.data(), lang);
        }
        ++processed;
    }

    ++gDirtyDrainCount;
    if (!gDirtyObjects.isEmpty()) {
        dispatch_async(dispatch_get_main_queue(), ^{
            drainDirtyObjects(lang);
        });
        return;
    }

    gDirtyDrainScheduled = false;
    dumpQtMenuInventory(lang);
}

void scheduleDirtyObjectDrain(QString lang)
{
    if (lang.isEmpty() || gDirtyDrainScheduled) {
        return;
    }

    gDirtyDrainScheduled = true;
    dispatch_async(dispatch_get_main_queue(), ^{
        drainDirtyObjects(lang);
    });
}

void enqueueRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty() || gDirtyObjectSet.contains(object)) {
        return;
    }

    const bool isRelevantObject = qobject_cast<QWidget *>(object) != nullptr ||
        qobject_cast<QAction *>(object) != nullptr ||
        qobject_cast<QMenu *>(object) != nullptr;
    if (!isRelevantObject) {
        return;
    }

    gDirtyObjectSet.insert(object);
    gDirtyObjects.append(DirtyObject{ object, QPointer<QObject>(object) });
    ++gDirtyEnqueueCount;
    scheduleDirtyObjectDrain(lang);
}

class RuntimeUiEventFilter final : public QObject {
public:
    explicit RuntimeUiEventFilter(const QString &lang)
        : QObject(QCoreApplication::instance()), m_lang(lang)
    {
    }

protected:
    bool eventFilter(QObject *watched, QEvent *event) override
    {
        if (watched == nullptr || event == nullptr || m_lang.isEmpty()) {
            return QObject::eventFilter(watched, event);
        }

        switch (event->type()) {
        case QEvent::Paint:
            if (qobject_cast<QLabel *>(watched) != nullptr) {
                translateRuntimeObject(watched, m_lang);
            }
            break;
        case QEvent::Show:
            if (QMenu *menu = qobject_cast<QMenu *>(watched)) {
                translateMenuBeforeFirstPaint(menu, m_lang, true);
                break;
            }
            enqueueRuntimeObject(watched, m_lang);
            scheduleInteractiveRefresh(m_lang);
            break;
        case QEvent::ActionAdded:
            if (QMenu *menu = qobject_cast<QMenu *>(watched)) {
                translateMenuBeforeFirstPaint(menu, m_lang, false);
                break;
            }
            enqueueRuntimeObject(watched, m_lang);
            scheduleInteractiveRefresh(m_lang);
            break;
        case QEvent::MouseButtonRelease:
            enqueueRuntimeObject(watched, m_lang);
            scheduleInteractiveRefresh(m_lang);
            break;
        case QEvent::ChildAdded: {
            QChildEvent *childEvent = static_cast<QChildEvent *>(event);
            enqueueRuntimeObject(childEvent->child(), m_lang);
            scheduleInteractiveRefresh(m_lang);
            break;
        }
        default:
            break;
        }

        return QObject::eventFilter(watched, event);
    }

private:
    QString m_lang;
};

void installRuntimeUiEventFilter(const QString &lang)
{
    QCoreApplication *app = QCoreApplication::instance();
    if (app == nullptr || lang.isEmpty() || gEventFilter != nullptr) {
        return;
    }

    gEventFilter = new RuntimeUiEventFilter(lang);
    app->installEventFilter(gEventFilter);
}

QString majorMinorVersion(const QString &version)
{
    const QStringList parts = version.split('.');
    if (parts.size() < 2) {
        return version;
    }
    return parts[0] + QStringLiteral(".") + parts[1];
}

bool installTranslator()
{
    QCoreApplication *app = QCoreApplication::instance();
    if (app == nullptr) {
        return false;
    }

    const QString lang = readEnvVar("CAVALRY_I18N_LANG");
    if (lang.isEmpty()) {
        fprintf(stderr, "[cavalry-i18n] injector loaded, but CAVALRY_I18N_LANG is empty\n");
        gInstallAttempted = true;
        return true;
    }

    const bool dumpOnlyEnglish = lang == QStringLiteral("en");
    int count = 0;
    if (!dumpOnlyEnglish && entriesForLanguage(lang, &count) == nullptr) {
        fprintf(stderr, "[cavalry-i18n] unsupported language: %s\n", lang.toUtf8().constData());
        gInstallAttempted = true;
        return true;
    }

    const QString buildQtVersion = QStringLiteral(QT_VERSION_STR);
    const QString runtimeQtVersion = QString::fromUtf8(qVersion());
    if (majorMinorVersion(buildQtVersion) != majorMinorVersion(runtimeQtVersion)) {
        fprintf(
            stderr,
            "[cavalry-i18n] injector Qt version mismatch build=%s runtime=%s\n",
            buildQtVersion.toUtf8().constData(),
            runtimeQtVersion.toUtf8().constData()
        );
        gInstallAttempted = true;
        return true;
    }

    if (gTranslator == nullptr) {
        if (!dumpOnlyEnglish) {
            gTranslator = new EmbeddedTranslator(lang, app);
            app->installTranslator(gTranslator);
            rebuildTranslationCache(lang);
        }
    }

    if (dumpOnlyEnglish) {
        bool inventoryExported = false;
        for (int attempt = 0; attempt < kMaxInstallAttempts; ++attempt) {
            if (dumpQtMenuInventory(lang)) {
                inventoryExported = true;
                break;
            }
            if (attempt < kMaxInstallAttempts - 1) {
                fprintf(stderr, "[cavalry-i18n] english dump-only export deferred, retrying... (attempt %d/%d)\n",
                        attempt + 1, kMaxInstallAttempts);
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kRetryDelayMs * NSEC_PER_MSEC)),
                               dispatch_get_main_queue(),
                               ^{
                                   QCoreApplication::processEvents(QEventLoop::AllEvents);
                               });
                QCoreApplication::processEvents(QEventLoop::AllEvents);
                usleep(kRetryDelayMs * 1000);
            }
        }

        if (inventoryExported) {
            fprintf(stderr, "[cavalry-i18n] english dump-only inventory exported\n");
            gInstallAttempted = true;
            return true;
        }

        fprintf(stderr, "[cavalry-i18n] failed to export english dump-only inventory after %d attempts\n",
                kMaxInstallAttempts);
        gInstallAttempted = true;
        return true;
    }

    if (!translateQtMenuBar(lang)) {
        return false;
    }

    translateQtWidgets(lang);
    dumpQtMenuInventory(lang);
    refreshNativeMenuBar(lang);

    installRuntimeUiEventFilter(lang);

    fprintf(
        stderr,
        "[cavalry-i18n] embedded translator installed lang=%s entries=%d\n",
        lang.toUtf8().constData(),
        count
    );

    gInstallAttempted = true;
    return true;
}

void scheduleInstallAttempt(int attempt)
{
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(attempt == 0 ? 0 : kRetryDelayMs) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            if (gInstallAttempted) {
                return;
            }

            if (installTranslator()) {
                return;
            }

            if (attempt + 1 < kMaxInstallAttempts) {
                scheduleInstallAttempt(attempt + 1);
            } else {
                fprintf(stderr, "[cavalry-i18n] injector gave up waiting for QCoreApplication\n");
            }
        }
    );
}

void bootstrapInjector()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        fprintf(stderr, "[cavalry-i18n] injector bootstrap\n");
        scheduleInstallAttempt(0);

        @autoreleasepool {
            [[NSNotificationCenter defaultCenter]
                addObserverForName:NSApplicationDidFinishLaunchingNotification
                            object:nil
                             queue:[NSOperationQueue mainQueue]
                        usingBlock:^(__unused NSNotification *note) {
                            const QString lang = readEnvVar("CAVALRY_I18N_LANG");
                            fprintf(stderr, "[cavalry-i18n] NSApplicationDidFinishLaunching lang=%s\n",
                                    lang.toUtf8().constData());
                            scheduleInstallAttempt(0);
                            refreshNativeMenuBar(lang);
                            scheduleRefreshAttempts(lang);
                        }];
        }
    });
}

} // namespace

__attribute__((constructor)) static void cavalryTranslatorInjectorLoad()
{
    bootstrapInjector();
}
