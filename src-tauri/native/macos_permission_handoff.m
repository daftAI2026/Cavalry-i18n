/**
 * [INPUT]: 依赖 AppKit/CoreGraphics/QuartzCore，消费 Tauri WebView 原生 NSView、CSS source rect、viewport 尺寸与一次性 C callback。
 * [OUTPUT]: 对外提供 cavalry_permission_handoff_start/finish；以 AppKit point geometry、每屏非激活 replicant、独立非激活箭头 panel、参考同形的“单行指令 / Back + App row”helper 和不含 NSBox 背景的整条实时 App row 快照承载 file-URL NSDraggingSession，并仅接受落在实时 System Settings 主窗口内的 Copy 结果。
 * [POS]: src-tauri/native 的 macOS 权限交接 owner；按 0.72/1.0 spring、50pt apex、1-p/p opacity、12pt 对向 blur、三层 shadow/stroke 实现洁净室 handoff，外层半透明材质属于本进程 accessory 而非 System Settings，且不读写 TCC 或自动拨动系统开关；整个 System Settings 窗口是拖拽判定区域。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/QuartzCore.h>
#include <math.h>
#include <stdbool.h>
typedef void (*CAVPermissionHandoffCallback)(void *context, int outcome, bool terminal);
static const NSInteger CAVOutcomeRetryRequested = 1; static const NSInteger CAVOutcomeDismissed = 2; static const NSInteger CAVOutcomeError = 3; static const CGFloat CAVZero = 0.0;
static const CGFloat CAVOne = 1.0; static const CGFloat CAVTwo = 2.0; static const CGFloat CAVHalf = 0.5; static const CGFloat CAVPi = 3.141592653589793;
static const NSTimeInterval CAVSpringResponse = 0.72; static const CGFloat CAVSpringDamping = 1.0; static const CGFloat CAVArcApex = 50.0; static const CGFloat CAVMaximumBlur = 12.0;
static const CGFloat CAVHelperWidth = 532.0; static const CGFloat CAVHelperHeight = 112.0; static const CGFloat CAVScreenInset = 20.0; static const CGFloat CAVRowHeight = 44.0;
static const CGFloat CAVCornerRadius = 12.0; static const CGFloat CAVRowCornerRadius = 8.0; static const CGFloat CAVProxyStrokeWidth = 0.5; static const CGFloat CAVProxyStrokeOpacity = 0.15;
static const CGFloat CAVArrowSize = 28.0; static const CGFloat CAVArrowTextGap = 8.0; static const CGFloat CAVArrowStrokeWidth = 2.0;
static const CGFloat CAVArrowDesignSize = 256.0; static const CGFloat CAVArrowDrawingInset = 2.0; static const CGFloat CAVInfoBlueGreen = 107.0 / 255.0;
static const CGFloat CAVArrowScaleX = 1.15; static const CGFloat CAVArrowScaleY = 1.6; static const CGFloat CAVArrowMass = 1.0; static const CGFloat CAVArrowStiffness = 200.0; static const CGFloat CAVArrowDamping = 11.0; static const NSTimeInterval CAVArrowInitialDelay = 0.5; static const NSTimeInterval CAVArrowStretchDuration = 0.25;
static const NSTimeInterval CAVArrowIdleDuration = 4.0; static const NSTimeInterval CAVSettingsProbeInterval = 0.10; static const NSUInteger CAVSettingsProbeLimit = 50; static const NSUInteger CAVSettingsMissingGrace = 10;
static const NSUInteger CAVIndexStep = 1;
static const CGFloat CAVAnimationFrameRate = 60.0; static const CGFloat CAVAnimationTolerance = 0.001;
static const CGFloat CAVInstructionTop = 12.0; static const CGFloat CAVInstructionHeight = 28.0; static const CGFloat CAVRowTop = 52.0; static const CGFloat CAVHelperHorizontalInset = 16.0;
static const CGFloat CAVBackButtonSize = 32.0; static const CGFloat CAVBackToRowGap = 16.0; static const CGFloat CAVShadowDestinationOpacity = 0.06;
static const CGFloat CAVShadowDestinationRadius = 2.0; static const CGFloat CAVShadowDestinationY = -3.0; static const CGFloat CAVShadowKeyOpacity = 0.09; static const CGFloat CAVShadowKeyRadius = 15.0;
static const CGFloat CAVShadowKeyY = -5.0; static const CGFloat CAVShadowAmbientOpacity = 0.20; static const CGFloat CAVShadowAmbientRadius = 3.0; static const CGFloat CAVShadowAmbientY = 0.0;
static const CGFloat CAVStrokeZPosition = 3.0; static const CGFloat CAVShadowDestinationZPosition = -1.0; static const CGFloat CAVShadowKeyZPosition = -2.0; static const CGFloat CAVShadowAmbientZPosition = -3.0;
static const CGFloat CAVInstructionFontSize = 13.0; static const CGFloat CAVRowIconInset = 8.0; static const CGFloat CAVRowIconSize = 28.0;
static const CGFloat CAVRowTextOriginX = 44.0; static const CGFloat CAVRowTextRightInset = 12.0; static const CGFloat CAVRowLabelHeight = 18.0;
static NSString *const CAVSystemSettingsBundleIdentifier = @"com.apple.systempreferences";
typedef NS_ENUM(NSInteger, CAVLocaleKind) { CAVLocaleEnglish, CAVLocaleSimplifiedChinese, CAVLocaleTraditionalChinese, CAVLocaleJapanese };
static NSString *const CAVTextInstruction = @"instruction"; static NSString *const CAVTextBack = @"back";
@class CAVPermissionHandoffCoordinator;
@interface CAVNonActivatingPanel : NSPanel
@end
@interface CAVFlippedVisualEffectView : NSVisualEffectView
@end
@interface CAVFlippedView : NSView
@end
@interface CAVHandoffArrowView : NSView
@property(nonatomic, strong) NSTrackingArea *hoverArea; @property(nonatomic, copy) dispatch_block_t onHover;
@end
@interface CAVReplicantView : NSView
@property(nonatomic, strong) NSImageView *sourceImageView; @property(nonatomic, strong) NSImageView *targetImageView;
@property(nonatomic, strong) CALayer *destinationShadowLayer; @property(nonatomic, strong) CALayer *keyShadowLayer;
@property(nonatomic, strong) CALayer *ambientShadowLayer; @property(nonatomic, strong) CALayer *strokeLayer;
@property(nonatomic, assign) BOOL allowsBlur;
- (instancetype)initWithFrame:(NSRect)frame sourceImage:(NSImage *)sourceImage targetImage:(NSImage *)targetImage scale:(CGFloat)scale allowsBlur:(BOOL)allowsBlur;
- (void)setMotionFrame:(NSRect)motionFrame progress:(CGFloat)progress;
@end
@interface CAVScreenReplicant : NSObject
@property(nonatomic, strong) NSScreen *screen; @property(nonatomic, strong) CAVNonActivatingPanel *panel;
@property(nonatomic, strong) CAVReplicantView *view; @property(nonatomic, assign) NSRect screenFrame;
- (instancetype)initWithScreen:(NSScreen *)screen frame:(NSRect)frame sourceImage:(NSImage *)sourceImage targetImage:(NSImage *)targetImage allowsBlur:(BOOL)allowsBlur;
- (void)setMotionFrame:(NSRect)motionFrame progress:(CGFloat)progress;
- (void)orderFront;
- (void)orderOut;
@end
@interface CAVDragSourceView : NSView <NSDraggingSource, NSPasteboardItemDataProvider>
@property(nonatomic, weak) CAVPermissionHandoffCoordinator *coordinator; @property(nonatomic, strong) NSURL *applicationBundleURL;
@property(nonatomic, strong) NSBox *box; @property(nonatomic, strong) NSView *appRowView;
@property(nonatomic, strong) NSImageView *iconView; @property(nonatomic, strong) NSTextField *titleField;
@end
@interface CAVPermissionHandoffCoordinator : NSObject
@property(nonatomic, assign) CAVPermissionHandoffCallback callback; @property(nonatomic, assign) void *callbackContext;
@property(nonatomic, weak) NSView *sourceView; @property(nonatomic, assign) NSRect sourceScreenRect;
@property(nonatomic, strong) NSImage *sourceImage; @property(nonatomic, strong) NSImage *targetImage;
@property(nonatomic, strong) CAVNonActivatingPanel *helperPanel; @property(nonatomic, strong) CAVNonActivatingPanel *arrowPanel; @property(nonatomic, strong) CAVDragSourceView *dragView;
@property(nonatomic, strong) CAVHandoffArrowView *arrowView; @property(nonatomic, strong) NSButton *backButton;
@property(nonatomic, strong) NSMutableArray<CAVScreenReplicant *> *replicants;
@property(nonatomic, strong) NSDraggingSession *dragSession; @property(nonatomic, strong) NSTimer *animationTimer;
@property(nonatomic, strong) NSTimer *locateTimer; @property(nonatomic, strong) NSTimer *targetTrackingTimer;
@property(nonatomic, strong) NSTimer *arrowTimer; @property(nonatomic, assign) CFTimeInterval animationStartedAt;
@property(nonatomic, assign) CGFloat animationStartProgress; @property(nonatomic, assign) CGFloat animationTargetProgress;
@property(nonatomic, assign) NSRect targetScreenRect; @property(nonatomic, assign) NSRect settingsFrame;
@property(nonatomic, assign) BOOL sessionClosed; @property(nonatomic, assign) BOOL dragging;
@property(nonatomic, assign) BOOL reducedMotion; @property(nonatomic, assign) BOOL reducedTransparency;
@property(nonatomic, assign) NSUInteger locateAttempts; @property(nonatomic, assign) NSUInteger missingSettingsAttempts;
@property(nonatomic, copy) NSString *screenTopologyKey;
- (instancetype)initWithView:(NSView *)view sourceRect:(NSRect)sourceRect viewportWidth:(CGFloat)viewportWidth viewportHeight:(CGFloat)viewportHeight hasSourceRect:(BOOL)hasSourceRect callback:(CAVPermissionHandoffCallback)callback context:(void *)context;
- (void)begin;
- (void)finishWithReverse:(BOOL)reverse;
- (void)retainDragSession:(NSDraggingSession *)session;
- (void)dragDidBegin;
- (void)dragDidEndWithOperation:(NSDragOperation)operation atScreenPoint:(NSPoint)screenPoint;
@end
static CAVPermissionHandoffCoordinator *CAVActiveCoordinator = nil;
static NSString *CAVApplicationDisplayName(void) {
  NSString *name = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleDisplayName"];
  if (name.length == CAVZero) name = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleName"];
  return name.length > CAVZero ? name : @"Cavalry Language Switcher";
}
static NSColor *CAVSeparatorColor(void) { if (@available(macOS 10.14, *)) return NSColor.separatorColor; return NSColor.gridColor; }
static BOOL CAVFinitePositive(CGFloat value) { return isfinite(value) && value > CAVZero; }
static BOOL CAVFiniteNonNegative(CGFloat value) { return isfinite(value) && value >= CAVZero; }
static NSRect CAVIntegralRectForScale(NSRect rect, CGFloat scale) {
  if (!CAVFinitePositive(scale)) return rect;
  CGFloat minX = round(NSMinX(rect) * scale) / scale;
  CGFloat minY = round(NSMinY(rect) * scale) / scale;
  CGFloat maxX = round(NSMaxX(rect) * scale) / scale;
  CGFloat maxY = round(NSMaxY(rect) * scale) / scale;
  return NSMakeRect(minX, minY, MAX(CAVZero, maxX - minX), MAX(CAVZero, maxY - minY));
}
static NSTextField *CAVLabel(NSString *text, CGFloat size, NSFontWeight weight, NSColor *color) {
  NSTextField *label = [NSTextField labelWithString:text];
  label.font = [NSFont systemFontOfSize:size weight:weight];
  label.textColor = color; label.lineBreakMode = NSLineBreakByTruncatingTail;
  label.usesSingleLineMode = YES;
  return label;
}
static CAVLocaleKind CAVPreferredLocaleKind(void) {
  NSString *language = [NSLocale.preferredLanguages.firstObject lowercaseString] ?: @"en";
  if ([language hasPrefix:@"ja"]) return CAVLocaleJapanese;
  if ([language hasPrefix:@"zh-hant"] || [language hasPrefix:@"zh-tw"] ||
      [language hasPrefix:@"zh-hk"] || [language hasPrefix:@"zh-mo"]) {
    return CAVLocaleTraditionalChinese;
  }
  if ([language hasPrefix:@"zh"]) return CAVLocaleSimplifiedChinese;
  return CAVLocaleEnglish;
}
static NSString *CAVHelperText(NSString *key) {
  CAVLocaleKind locale = CAVPreferredLocaleKind();
  NSArray<NSDictionary<NSString *, NSString *> *> *texts = @[
    @{CAVTextInstruction: @"Drag %@ to the list above to allow App Management", CAVTextBack: @"Back"},
    @{CAVTextInstruction: @"将“%@”拖入上方列表以允许 App 管理", CAVTextBack: @"返回"},
    @{CAVTextInstruction: @"將「%@」拖入上方列表以允許 App 管理", CAVTextBack: @"返回"},
    @{CAVTextInstruction: @"%@を上のリストにドラッグしてアプリケーション管理を許可", CAVTextBack: @"戻る"},
  ];
  return texts[locale][key] ?: texts[CAVLocaleEnglish][key];
}
static NSImage *CAVSnapshot(NSView *view, NSRect localRect) {
  if (!view || NSIsEmptyRect(localRect)) return nil;
  NSBitmapImageRep *rep = [view bitmapImageRepForCachingDisplayInRect:localRect];
  if (!rep) return nil;
  [view cacheDisplayInRect:localRect toBitmapImageRep:rep];
  NSImage *image = [[NSImage alloc] initWithSize:localRect.size];
  [image addRepresentation:rep];
  return image;
}
/* CSS viewport is the only scale input; no titlebar or DPR offset is added. */
static NSRect CAVSourceLocalRect(NSView *view, NSRect cssRect, CGFloat viewportWidth, CGFloat viewportHeight, BOOL *valid) {
  if (valid) *valid = NO;
  if (!view || !CAVFinitePositive(viewportWidth) || !CAVFinitePositive(viewportHeight) ||
      !CAVFiniteNonNegative(cssRect.origin.x) || !CAVFiniteNonNegative(cssRect.origin.y) ||
      !CAVFinitePositive(cssRect.size.width) || !CAVFinitePositive(cssRect.size.height)) {
    return NSZeroRect;
  }
  if (NSMaxX(cssRect) > viewportWidth || NSMaxY(cssRect) > viewportHeight) return NSZeroRect;
  NSRect bounds = view.bounds;
  CGFloat boundsWidth = NSWidth(bounds);
  CGFloat boundsHeight = NSHeight(bounds);
  if (!CAVFinitePositive(boundsWidth) || !CAVFinitePositive(boundsHeight)) return NSZeroRect;
  CGFloat scaleX = boundsWidth / viewportWidth;
  CGFloat scaleY = boundsHeight / viewportHeight;
  if (!CAVFinitePositive(scaleX) || !CAVFinitePositive(scaleY) || !isfinite(scaleX) || !isfinite(scaleY)) {
    return NSZeroRect;
  }
  CGFloat width = cssRect.size.width * scaleX;
  CGFloat height = cssRect.size.height * scaleY;
  CGFloat x = NSMinX(bounds) + cssRect.origin.x * scaleX;
  CGFloat y = view.isFlipped ? NSMinY(bounds) + cssRect.origin.y * scaleY
                             : NSMaxY(bounds) - cssRect.origin.y * scaleY - height;
  NSRect localRect = NSMakeRect(x, y, width, height);
  if (!NSContainsRect(bounds, localRect)) return NSZeroRect;
  if (valid) *valid = YES;
  return localRect;
}
static NSRect CAVSourceScreenRect(NSView *view, NSRect cssRect, CGFloat viewportWidth, CGFloat viewportHeight, NSRect *localRectOut, BOOL *valid) {
  NSRect localRect = CAVSourceLocalRect(view, cssRect, viewportWidth, viewportHeight, valid);
  if (localRectOut) *localRectOut = localRect;
  if (NSIsEmptyRect(localRect) || !view.window) return NSZeroRect;
  NSRect windowRect = [view convertRect:localRect toView:nil];
  return [view.window convertRectToScreen:windowRect];
}
static NSScreen *CAVScreenForDisplay(CGDirectDisplayID displayID) {
  for (NSScreen *screen in NSScreen.screens) {
    NSNumber *number = screen.deviceDescription[@"NSScreenNumber"];
    if (number.unsignedIntValue == displayID) return screen;
  }
  return NSScreen.mainScreen;
}
static NSScreen *CAVScreenForAppKitRect(NSRect rect) {
  NSScreen *bestScreen = NSScreen.mainScreen;
  CGFloat bestArea = CAVZero;
  for (NSScreen *screen in NSScreen.screens) {
    NSRect intersection = NSIntersectionRect(rect, screen.frame);
    CGFloat area = NSWidth(intersection) * NSHeight(intersection);
    if (area > bestArea) {
      bestArea = area;
      bestScreen = screen;
    }
  }
  return bestScreen;
}
static NSRect CAVQuartzToAppKitRect(CGRect quartzRect) {
  CGDirectDisplayID displayID = CGMainDisplayID();
  CGFloat bestArea = CAVZero;
  uint32_t displayCount = CAVZero;
  CGGetActiveDisplayList(0, NULL, &displayCount);
  if (displayCount > CAVZero) {
    CGDirectDisplayID *displayIDs = calloc(displayCount, sizeof(CGDirectDisplayID));
    if (displayIDs) {
      CGGetActiveDisplayList(displayCount, displayIDs, &displayCount);
      for (uint32_t index = CAVZero; index < displayCount; index += (uint32_t)CAVIndexStep) {
        CGRect displayBounds = CGDisplayBounds(displayIDs[index]);
        CGRect intersection = CGRectIntersection(quartzRect, displayBounds);
        CGFloat area = CGRectIsNull(intersection) ? CAVZero :
                       CGRectGetWidth(intersection) * CGRectGetHeight(intersection);
        if (area > bestArea) {
          bestArea = area;
          displayID = displayIDs[index];
        }
      }
      free(displayIDs);
    }
  }
  CGRect displayBounds = CGDisplayBounds(displayID);
  NSScreen *screen = CAVScreenForDisplay(displayID);
  CGFloat x = NSMinX(screen.frame) + CGRectGetMinX(quartzRect) - CGRectGetMinX(displayBounds);
  CGFloat y = NSMinY(screen.frame) + CGRectGetMaxY(displayBounds) - CGRectGetMaxY(quartzRect);
  return NSMakeRect(x, y, CGRectGetWidth(quartzRect), CGRectGetHeight(quartzRect));
}
static NSRect CAVSystemSettingsWindowFrame(void) {
  CFArrayRef windowsRef = CGWindowListCopyWindowInfo(
    kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
  NSArray *windows = CFBridgingRelease(windowsRef);
  NSRect best = NSZeroRect;
  CGFloat bestArea = CAVZero;
  for (NSDictionary *window in windows) {
    if ([window[(id)kCGWindowLayer] integerValue] != CAVZero) continue;
    pid_t pid = [window[(id)kCGWindowOwnerPID] intValue];
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    if (![application.bundleIdentifier isEqualToString:CAVSystemSettingsBundleIdentifier]) continue;
    CGRect bounds = CGRectZero;
    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(id)kCGWindowBounds], &bounds)) continue;
    CGFloat area = CGRectGetWidth(bounds) * CGRectGetHeight(bounds);
    if (area <= bestArea) continue;
    bestArea = area;
    best = CAVQuartzToAppKitRect(bounds);
  }
  return best;
}
static NSRect CAVHelperFrame(NSRect settingsFrame) {
  NSScreen *screen = CAVScreenForAppKitRect(settingsFrame);
  NSRect visible = screen.visibleFrame;
  CGFloat x = NSMidX(settingsFrame) - CAVHelperWidth * CAVHalf;
  CGFloat y = NSMinY(visible) + CAVScreenInset;
  x = MAX(NSMinX(visible) + CAVScreenInset,
          MIN(x, NSMaxX(visible) - CAVHelperWidth - CAVScreenInset));
  y = MAX(NSMinY(visible) + CAVScreenInset,
          MIN(y, NSMaxY(visible) - CAVHelperHeight - CAVScreenInset));
  return CAVIntegralRectForScale(NSMakeRect(x, y, CAVHelperWidth, CAVHelperHeight), screen.backingScaleFactor);
}
static NSString *CAVScreenTopologyKey(void) {
  NSMutableString *key = [NSMutableString string];
  for (NSScreen *screen in NSScreen.screens) {
    [key appendFormat:@"%.3f,%.3f,%.3f,%.3f@%.3f;", NSMinX(screen.frame), NSMinY(screen.frame),
                      NSWidth(screen.frame), NSHeight(screen.frame), screen.backingScaleFactor];
  }
  return key;
}
static CGPathRef CAVRoundedPath(NSRect bounds) {
  return CGPathCreateWithRoundedRect(NSRectToCGRect(bounds), CAVCornerRadius, CAVCornerRadius, NULL);
}
static id CAVBlurFilter(CGFloat radius) {
  if (radius <= CAVZero) return nil;
  Class filterClass = NSClassFromString(@"CIFilter"); if (!filterClass) return nil;
  SEL selector = NSSelectorFromString(@"filterWithName:"); id (*factory)(id, SEL, id) = (id (*)(id, SEL, id))[filterClass methodForSelector:selector];
  id filter = factory ? factory(filterClass, selector, @"CIGaussianBlur") : nil; [filter setValue:@(radius) forKey:@"inputRadius"];
  return filter;
}
static void CAVSetBlur(NSImageView *imageView, CGFloat radius, BOOL enabled) {
  imageView.layer.filters = nil; imageView.layer.shouldRasterize = NO;
  if (!enabled || radius <= CAVZero) return;
  id filter = CAVBlurFilter(radius); if (!filter) return;
  imageView.layer.filters = @[filter]; imageView.layer.shouldRasterize = YES;
  imageView.layer.rasterizationScale = imageView.window.backingScaleFactor;
}
static void CAVAnimateArrow(CALayer *layer, CGFloat scaleX, CGFloat scaleY) { if (!layer) return;
  CALayer *presentation = layer.presentationLayer; CATransform3D from = presentation ? presentation.transform : layer.transform;
  CATransform3D to = CATransform3DMakeScale(scaleX, scaleY, CAVOne); CASpringAnimation *spring = [CASpringAnimation animationWithKeyPath:@"transform"];
  spring.mass = CAVArrowMass; spring.stiffness = CAVArrowStiffness; spring.damping = CAVArrowDamping; spring.initialVelocity = CAVZero;
  spring.fromValue = [NSValue valueWithCATransform3D:from]; spring.toValue = [NSValue valueWithCATransform3D:to]; spring.duration = spring.settlingDuration;
  layer.transform = to; [layer addAnimation:spring forKey:@"cavalry-handoff-arrow"];
}
@implementation CAVNonActivatingPanel
- (BOOL)canBecomeKeyWindow { return NO; }
- (BOOL)canBecomeMainWindow { return NO; }
@end
@implementation CAVFlippedVisualEffectView
- (BOOL)isFlipped { return YES; }
@end
@implementation CAVFlippedView
- (BOOL)isFlipped { return YES; }
@end
@implementation CAVHandoffArrowView
- (BOOL)isFlipped { return YES; }
- (void)updateTrackingAreas { [super updateTrackingAreas]; if (self.hoverArea) [self removeTrackingArea:self.hoverArea]; self.hoverArea = [[NSTrackingArea alloc] initWithRect:self.bounds options:NSTrackingMouseEnteredAndExited | NSTrackingActiveAlways | NSTrackingInVisibleRect owner:self userInfo:nil]; [self addTrackingArea:self.hoverArea]; }
- (void)mouseEntered:(NSEvent *)event { if (self.onHover) self.onHover(); }
- (void)drawRect:(NSRect)dirtyRect {
  CGFloat extent = MIN(NSWidth(self.bounds), NSHeight(self.bounds)) - CAVTwo * CAVArrowDrawingInset;
  CGFloat scale = extent / CAVArrowDesignSize;
  NSPoint (^point)(CGFloat, CGFloat) = ^NSPoint(CGFloat x, CGFloat y) {
    return NSMakePoint(CAVArrowDrawingInset + x * scale, CAVArrowDrawingInset + y * scale);
  };
  NSBezierPath *arrow = [NSBezierPath bezierPath];
  [arrow moveToPoint:point(128, 20)]; [arrow lineToPoint:point(232, 116)];
  [arrow curveToPoint:point(232, 132) controlPoint1:point(238.25, 122.25) controlPoint2:point(238.25, 125.75)]; [arrow lineToPoint:point(200, 164)];
  [arrow curveToPoint:point(184, 164) controlPoint1:point(193.75, 170.25) controlPoint2:point(190.25, 170.25)];
  [arrow lineToPoint:point(160, 140)]; [arrow lineToPoint:point(160, 224)];
  [arrow curveToPoint:point(152, 232) controlPoint1:point(160, 228.42) controlPoint2:point(156.42, 232)]; [arrow lineToPoint:point(104, 232)];
  [arrow curveToPoint:point(96, 224) controlPoint1:point(99.58, 232) controlPoint2:point(96, 228.42)];
  [arrow lineToPoint:point(96, 140)]; [arrow lineToPoint:point(72, 164)];
  [arrow curveToPoint:point(56, 164) controlPoint1:point(65.75, 170.25) controlPoint2:point(62.25, 170.25)]; [arrow lineToPoint:point(24, 132)];
  [arrow curveToPoint:point(24, 116) controlPoint1:point(17.75, 125.75) controlPoint2:point(17.75, 122.25)];
  [arrow closePath];
  arrow.lineWidth = CAVArrowStrokeWidth; arrow.lineJoinStyle = NSLineJoinStyleRound;
  [[NSColor colorWithSRGBRed:CAVZero green:CAVInfoBlueGreen blue:CAVOne alpha:CAVOne] setFill]; [NSColor.whiteColor setStroke];
  [arrow fill]; [arrow stroke];
}
@end
@implementation CAVReplicantView
- (instancetype)initWithFrame:(NSRect)frame sourceImage:(NSImage *)sourceImage targetImage:(NSImage *)targetImage scale:(CGFloat)scale allowsBlur:(BOOL)allowsBlur {
  self = [super initWithFrame:frame];
  if (!self) return nil;
  _allowsBlur = allowsBlur;
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.clearColor.CGColor;
  self.layer.contentsScale = scale;
  self.layer.masksToBounds = NO;
  _ambientShadowLayer = [CALayer layer];
  _destinationShadowLayer = [CALayer layer];
  _keyShadowLayer = [CALayer layer];
  _strokeLayer = [CALayer layer];
  NSArray<CALayer *> *shadows = @[_ambientShadowLayer, _destinationShadowLayer, _keyShadowLayer];
  NSArray<NSNumber *> *opacities = @[@(CAVShadowAmbientOpacity), @(CAVShadowDestinationOpacity), @(CAVShadowKeyOpacity)];
  NSArray<NSNumber *> *radii = @[@(CAVShadowAmbientRadius), @(CAVShadowDestinationRadius), @(CAVShadowKeyRadius)];
  NSArray<NSNumber *> *offsets = @[@(CAVShadowAmbientY), @(CAVShadowDestinationY), @(CAVShadowKeyY)];
  NSArray<NSNumber *> *zPositions = @[@(CAVShadowAmbientZPosition), @(CAVShadowDestinationZPosition), @(CAVShadowKeyZPosition)];
  for (NSUInteger index = CAVZero; index < shadows.count; index += CAVIndexStep) {
    CALayer *shadow = shadows[index];
    shadow.shadowColor = NSColor.blackColor.CGColor;
    shadow.shadowOpacity = opacities[index].floatValue;
    shadow.shadowRadius = radii[index].floatValue;
    shadow.shadowOffset = CGSizeMake(CAVZero, offsets[index].floatValue);
    shadow.zPosition = zPositions[index].floatValue;
    [self.layer addSublayer:shadow];
  }
  _strokeLayer.borderWidth = CAVProxyStrokeWidth;
  _strokeLayer.borderColor = [NSColor colorWithWhite:CAVZero alpha:CAVProxyStrokeOpacity].CGColor;
  _strokeLayer.zPosition = CAVStrokeZPosition;
  [self.layer addSublayer:_strokeLayer];
  _sourceImageView = [[NSImageView alloc] initWithFrame:NSZeroRect];
  _targetImageView = [[NSImageView alloc] initWithFrame:NSZeroRect];
  for (NSImageView *imageView in @[_sourceImageView, _targetImageView]) {
    imageView.imageScaling = NSImageScaleAxesIndependently;
    imageView.wantsLayer = YES;
    imageView.layer.masksToBounds = NO;
    imageView.layer.contentsScale = scale;
    [self addSubview:imageView];
  }
  _sourceImageView.image = sourceImage;
  _targetImageView.image = targetImage;
  return self;
}
- (void)setMotionFrame:(NSRect)motionFrame progress:(CGFloat)progress {
  progress = MIN(CAVOne, MAX(CAVZero, progress));
  NSRect frame = CAVIntegralRectForScale(motionFrame, self.layer.contentsScale);
  self.sourceImageView.frame = frame;
  self.targetImageView.frame = frame;
  self.strokeLayer.frame = frame;
  for (CALayer *shadow in @[_ambientShadowLayer, _destinationShadowLayer, _keyShadowLayer]) {
    shadow.frame = frame;
    CGPathRef path = CAVRoundedPath(NSMakeRect(CAVZero, CAVZero, NSWidth(frame), NSHeight(frame)));
    shadow.shadowPath = path;
    CGPathRelease(path);
  }
  self.sourceImageView.alphaValue = CAVOne - progress;
  self.targetImageView.alphaValue = progress;
  self.destinationShadowLayer.shadowOpacity = CAVShadowDestinationOpacity * progress;
  self.strokeLayer.opacity = progress;
  CAVSetBlur(self.sourceImageView, CAVMaximumBlur * progress, self.allowsBlur);
  CAVSetBlur(self.targetImageView, CAVMaximumBlur * (CAVOne - progress), self.allowsBlur);
}
@end
@implementation CAVScreenReplicant
- (instancetype)initWithScreen:(NSScreen *)screen frame:(NSRect)frame sourceImage:(NSImage *)sourceImage targetImage:(NSImage *)targetImage allowsBlur:(BOOL)allowsBlur {
  self = [super init];
  if (!self) return nil;
  _screen = screen;
  _screenFrame = frame;
  _panel = [[CAVNonActivatingPanel alloc]
    initWithContentRect:frame
              styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
                backing:NSBackingStoreBuffered
                  defer:NO];
  _panel.releasedWhenClosed = NO;
  _panel.opaque = NO;
  _panel.backgroundColor = NSColor.clearColor;
  _panel.hasShadow = NO;
  _panel.ignoresMouseEvents = YES;
  _panel.level = NSFloatingWindowLevel;
  _view = [[CAVReplicantView alloc] initWithFrame:_panel.contentView.bounds
                                      sourceImage:sourceImage
                                      targetImage:targetImage
                                            scale:screen.backingScaleFactor
                                      allowsBlur:allowsBlur];
  _view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  _panel.contentView = _view;
  return self;
}
- (void)setMotionFrame:(NSRect)motionFrame progress:(CGFloat)progress {
  NSRect localFrame = NSOffsetRect(motionFrame, -NSMinX(self.screenFrame), -NSMinY(self.screenFrame));
  [self.view setMotionFrame:localFrame progress:progress];
}
- (void)orderFront { [self.panel orderFront:nil]; }
- (void)orderOut { [self.panel orderOut:nil]; }
@end
@implementation CAVDragSourceView
- (BOOL)isFlipped { return YES; }
- (instancetype)initWithFrame:(NSRect)frameRect {
  self = [super initWithFrame:frameRect];
  if (!self) return nil;
  _box = [[NSBox alloc] initWithFrame:self.bounds]; _box.boxType = NSBoxCustom;
  _box.borderColor = CAVSeparatorColor(); _box.borderWidth = CAVProxyStrokeWidth;
  _box.fillColor = NSColor.controlBackgroundColor; _box.cornerRadius = CAVRowCornerRadius;
  [self addSubview:_box];
  _appRowView = [[CAVFlippedView alloc] initWithFrame:self.bounds]; [self addSubview:_appRowView];
  _iconView = [[NSImageView alloc] initWithFrame:NSMakeRect(CAVRowIconInset, CAVRowIconInset, CAVRowIconSize, CAVRowIconSize)];
  _iconView.image = [NSWorkspace.sharedWorkspace iconForFile:NSBundle.mainBundle.bundlePath];
  _iconView.imageScaling = NSImageScaleProportionallyUpOrDown;
  [_appRowView addSubview:_iconView];
  _titleField = CAVLabel(CAVApplicationDisplayName(), CAVInstructionFontSize, NSFontWeightMedium, NSColor.labelColor);
  CGFloat titleY = (CAVRowHeight - CAVRowLabelHeight) * CAVHalf;
  _titleField.frame = NSMakeRect(CAVRowTextOriginX, titleY, NSWidth(frameRect) - CAVRowTextOriginX - CAVRowTextRightInset, CAVRowLabelHeight);
  [_appRowView addSubview:_titleField];
  return self;
}
- (void)mouseDown:(NSEvent *)event {
  self.applicationBundleURL = NSBundle.mainBundle.bundleURL;
  if (!self.applicationBundleURL) return;
  NSPasteboardItem *pasteboardItem = [[NSPasteboardItem alloc] init];
  [pasteboardItem setDataProvider:self forTypes:@[NSPasteboardTypeFileURL]];
  NSDraggingItem *item = [[NSDraggingItem alloc] initWithPasteboardWriter:pasteboardItem];
  NSRect dragFrame = self.appRowView.frame; NSImage *dragImage = CAVSnapshot(self.appRowView, self.appRowView.bounds);
  if (!dragImage) return;
  [item setDraggingFrame:dragFrame contents:dragImage];
  NSDraggingSession *session = [self beginDraggingSessionWithItems:@[item] event:event source:self];
  session.animatesToStartingPositionsOnCancelOrFail = YES;
  [self.coordinator retainDragSession:session];
}
- (void)pasteboard:(NSPasteboard *)pasteboard item:(NSPasteboardItem *)item provideDataForType:(NSPasteboardType)type {
  if ([type isEqualToString:NSPasteboardTypeFileURL] && self.applicationBundleURL) [item setString:self.applicationBundleURL.absoluteString forType:NSPasteboardTypeFileURL];
}
- (NSDragOperation)draggingSession:(NSDraggingSession *)session sourceOperationMaskForDraggingContext:(NSDraggingContext)context {
  return NSDragOperationCopy;
}
- (BOOL)ignoreModifierKeysForDraggingSession:(NSDraggingSession *)session { return YES; }
- (void)draggingSession:(NSDraggingSession *)session willBeginAtPoint:(NSPoint)screenPoint { self.appRowView.hidden = YES; [self.coordinator dragDidBegin]; }
- (void)draggingSession:(NSDraggingSession *)session endedAtPoint:(NSPoint)screenPoint operation:(NSDragOperation)operation {
  [self.coordinator dragDidEndWithOperation:operation atScreenPoint:screenPoint];
  self.appRowView.hidden = NO;
  self.applicationBundleURL = nil;
}
@end
@implementation CAVPermissionHandoffCoordinator
- (instancetype)initWithView:(NSView *)view sourceRect:(NSRect)sourceRect viewportWidth:(CGFloat)viewportWidth viewportHeight:(CGFloat)viewportHeight hasSourceRect:(BOOL)hasSourceRect callback:(CAVPermissionHandoffCallback)callback context:(void *)context {
  self = [super init];
  if (!self) return nil;
  _sourceView = view;
  _callback = callback;
  _callbackContext = context;
  _replicants = [NSMutableArray array];
  _reducedMotion = NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion;
  _reducedTransparency = NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceTransparency;
  if (hasSourceRect && view.window) {
    NSRect localRect = NSZeroRect;
    BOOL valid = NO;
    _sourceScreenRect = CAVSourceScreenRect(view, sourceRect, viewportWidth, viewportHeight, &localRect, &valid);
    if (valid && !NSIsEmptyRect(_sourceScreenRect)) _sourceImage = CAVSnapshot(view, localRect);
  }
  return self;
}
- (void)sendOutcome:(NSInteger)outcome terminal:(BOOL)terminal {
  if (self.sessionClosed || !self.callback) return;
  if (terminal) self.sessionClosed = YES;
  CAVPermissionHandoffCallback callback = self.callback;
  void *context = self.callbackContext;
  if (terminal) {
    self.callback = NULL;
    self.callbackContext = NULL;
  }
  callback(context, (int)outcome, terminal);
}
- (void)begin {
  [self locateSettings:nil];
  self.locateTimer = [NSTimer scheduledTimerWithTimeInterval:CAVSettingsProbeInterval
                                                     target:self
                                                   selector:@selector(locateSettings:)
                                                   userInfo:nil
                                                    repeats:YES];
}
- (void)locateSettings:(NSTimer *)timer {
  self.locateAttempts += CAVIndexStep;
  NSRect settingsFrame = CAVSystemSettingsWindowFrame();
  if (NSIsEmptyRect(settingsFrame)) {
    if (self.locateAttempts < CAVSettingsProbeLimit) return;
    [self sendOutcome:CAVOutcomeError terminal:YES];
    [self cleanup];
    return;
  }
  [self.locateTimer invalidate];
  self.locateTimer = nil;
  self.settingsFrame = settingsFrame;
  [self buildHelperAtFrame:CAVHelperFrame(settingsFrame)];
  self.targetTrackingTimer = [NSTimer scheduledTimerWithTimeInterval:CAVSettingsProbeInterval
                                                               target:self
                                                             selector:@selector(trackSettings:)
                                                             userInfo:nil
                                                              repeats:YES];
  BOOL staticFallback = self.reducedMotion || !self.sourceImage || NSIsEmptyRect(self.sourceScreenRect);
  if (staticFallback) {
    [self.helperPanel orderFront:nil];
    return;
  }
  [self startTransitionToProgress:CAVOne];
}
- (void)trackSettings:(NSTimer *)timer {
  NSRect settingsFrame = CAVSystemSettingsWindowFrame();
  if (NSIsEmptyRect(settingsFrame)) {
    self.missingSettingsAttempts += CAVIndexStep;
    if (self.missingSettingsAttempts < CAVSettingsMissingGrace || self.dragging) return;
    [self sendOutcome:CAVOutcomeDismissed terminal:YES];
    [self cleanup];
    return;
  }
  self.missingSettingsAttempts = CAVZero;
  self.settingsFrame = settingsFrame;
  if (self.helperPanel && !self.dragging) [self moveHelperToFrame:CAVHelperFrame(settingsFrame)];
}
- (void)buildHelperAtFrame:(NSRect)frame {
  CAVNonActivatingPanel *panel = [[CAVNonActivatingPanel alloc]
    initWithContentRect:frame
              styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
                backing:NSBackingStoreBuffered
                  defer:NO];
  panel.releasedWhenClosed = NO;
  panel.level = NSFloatingWindowLevel;
  panel.opaque = self.reducedTransparency;
  panel.backgroundColor = self.reducedTransparency ? NSColor.windowBackgroundColor : NSColor.clearColor;
  panel.hasShadow = NO;
  panel.hidesOnDeactivate = NO;
  CAVFlippedVisualEffectView *surface = [[CAVFlippedVisualEffectView alloc]
    initWithFrame:NSMakeRect(CAVZero, CAVZero, CAVHelperWidth, CAVHelperHeight)];
  surface.material = NSVisualEffectMaterialPopover;
  surface.blendingMode = NSVisualEffectBlendingModeBehindWindow;
  surface.state = NSVisualEffectStateActive;
  surface.wantsLayer = YES;
  surface.layer.cornerRadius = CAVCornerRadius;
  surface.layer.borderWidth = CAVProxyStrokeWidth;
  surface.layer.borderColor = CAVSeparatorColor().CGColor;
  surface.layer.masksToBounds = YES;
  panel.contentView = surface;
  NSString *instructionText = [NSString stringWithFormat:CAVHelperText(CAVTextInstruction), CAVApplicationDisplayName()];
  NSTextField *instruction = CAVLabel(instructionText, CAVInstructionFontSize, NSFontWeightMedium, NSColor.labelColor);
  [instruction sizeToFit];
  CGFloat maximumInstructionWidth = CAVHelperWidth - CAVTwo * CAVHelperHorizontalInset - CAVArrowSize - CAVArrowTextGap;
  CGFloat instructionWidth = MIN(NSWidth(instruction.frame), maximumInstructionWidth);
  CGFloat instructionGroupWidth = CAVArrowSize + CAVArrowTextGap + instructionWidth;
  CGFloat instructionGroupX = (CAVHelperWidth - instructionGroupWidth) * CAVHalf;
  instruction.frame = NSMakeRect(instructionGroupX + CAVArrowSize + CAVArrowTextGap,
                                 CAVInstructionTop + (CAVInstructionHeight - CAVRowLabelHeight) * CAVHalf,
                                 instructionWidth, CAVRowLabelHeight);
  [surface addSubview:instruction];
  CGFloat rowX = CAVHelperHorizontalInset + CAVBackButtonSize + CAVBackToRowGap;
  CGFloat rowWidth = CAVHelperWidth - rowX - CAVHelperHorizontalInset;
  CAVDragSourceView *row = [[CAVDragSourceView alloc]
    initWithFrame:NSMakeRect(rowX, CAVRowTop, rowWidth, CAVRowHeight)];
  row.coordinator = self;
  [surface addSubview:row];
  self.dragView = row;
  NSImage *backImage = nil;
  if (@available(macOS 11.0, *)) {
    backImage = [NSImage imageWithSystemSymbolName:@"chevron.left"
                          accessibilityDescription:CAVHelperText(CAVTextBack)];
  } else {
    backImage = [NSImage imageNamed:NSImageNameGoLeftTemplate];
  }
  NSButton *back = [NSButton buttonWithImage:backImage target:self action:@selector(back:)];
  back.bezelStyle = NSBezelStyleCircular;
  back.focusRingType = NSFocusRingTypeNone;
  back.frame = NSMakeRect(CAVHelperHorizontalInset,
                          CAVRowTop + (CAVRowHeight - CAVBackButtonSize) * CAVHalf,
                          CAVBackButtonSize, CAVBackButtonSize);
  back.toolTip = CAVHelperText(CAVTextBack);
  [back setAccessibilityLabel:CAVHelperText(CAVTextBack)];
  [surface addSubview:back];
  self.backButton = back;
  CGFloat arrowX = instructionGroupX;
  CGFloat arrowY = CAVHelperHeight - CAVInstructionTop - CAVArrowSize;
  NSRect arrowScreenFrame = NSMakeRect(NSMinX(frame) + arrowX, NSMinY(frame) + arrowY,
                                       CAVArrowSize, CAVArrowSize);
  CAVNonActivatingPanel *arrowPanel = [[CAVNonActivatingPanel alloc]
    initWithContentRect:arrowScreenFrame styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel backing:NSBackingStoreBuffered defer:NO];
  arrowPanel.releasedWhenClosed = NO; arrowPanel.opaque = NO; arrowPanel.backgroundColor = NSColor.clearColor;
  arrowPanel.hasShadow = NO; arrowPanel.ignoresMouseEvents = NO; arrowPanel.level = NSFloatingWindowLevel;
  CAVHandoffArrowView *arrow = [[CAVHandoffArrowView alloc] initWithFrame:NSMakeRect(CAVZero, CAVZero, CAVArrowSize, CAVArrowSize)];
  arrow.wantsLayer = YES; arrow.toolTip = instructionText;
  __weak CAVPermissionHandoffCoordinator *weakSelf = self; arrow.onHover = ^{ [weakSelf stretchArrow:nil]; };
  arrowPanel.contentView = arrow; [panel addChildWindow:arrowPanel ordered:NSWindowAbove];
  self.arrowPanel = arrowPanel; self.arrowView = arrow;
  self.helperPanel = panel;
  [self updateTargetGeometry];
  if (!self.reducedMotion) [self scheduleArrowCycleAfter:CAVArrowInitialDelay];
}
- (void)moveHelperToFrame:(NSRect)frame {
  [self.helperPanel setFrame:frame display:YES animate:NO];
  [self updateTargetGeometry];
}
- (void)updateTargetGeometry {
  if (!self.helperPanel || !self.dragView) return;
  NSView *surface = self.helperPanel.contentView;
  NSRect rowRect = [surface convertRect:self.dragView.frame toView:nil];
  self.targetScreenRect = [self.helperPanel convertRectToScreen:rowRect];
  if (!self.targetImage) self.targetImage = CAVSnapshot(self.dragView, self.dragView.bounds);
}
- (void)back:(id)sender {
  [self sendOutcome:CAVOutcomeDismissed terminal:YES];
  [self finishWithReverse:YES];
}
- (void)scheduleArrowCycleAfter:(NSTimeInterval)delay {
  [self.arrowTimer invalidate];
  self.arrowTimer = [NSTimer scheduledTimerWithTimeInterval:delay
                                                     target:self
                                                   selector:@selector(stretchArrow:)
                                                   userInfo:nil
                                                    repeats:NO];
}
- (void)stretchArrow:(NSTimer *)timer {
  [self.arrowTimer invalidate]; self.arrowTimer = nil;
  if (!self.helperPanel.isVisible || self.dragging || !self.arrowView) {
    [self scheduleArrowCycleAfter:CAVArrowIdleDuration];
    return;
  }
  CAVAnimateArrow(self.arrowView.layer, CAVArrowScaleX, CAVArrowScaleY);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(CAVArrowStretchDuration * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    if (self.helperPanel.isVisible && !self.dragging) CAVAnimateArrow(self.arrowView.layer, CAVOne, CAVOne);
    [self scheduleArrowCycleAfter:CAVArrowIdleDuration];
  });
}
- (void)rebuildReplicants {
  for (CAVScreenReplicant *replicant in self.replicants) [replicant orderOut];
  [self.replicants removeAllObjects];
  BOOL allowsBlur = !self.reducedTransparency;
  for (NSScreen *screen in NSScreen.screens) {
    CGFloat scale = screen.backingScaleFactor;
    NSRect screenFrame = CAVIntegralRectForScale(screen.frame, scale);
    CAVScreenReplicant *replicant = [[CAVScreenReplicant alloc]
      initWithScreen:screen frame:screenFrame sourceImage:self.sourceImage targetImage:self.targetImage allowsBlur:allowsBlur];
    [self.replicants addObject:replicant];
  }
  self.screenTopologyKey = CAVScreenTopologyKey();
}
- (CGFloat)springProgressForElapsed:(CFTimeInterval)elapsed {
  if (elapsed <= CAVZero) return CAVZero;
  CGFloat omega = CAVTwo * CAVPi / CAVSpringResponse;
  CGFloat damping = CAVSpringDamping;
  if (fabs(damping - CAVOne) < CAVAnimationTolerance) {
    return MIN(CAVOne, CAVOne - exp(-omega * elapsed) * (CAVOne + omega * elapsed));
  }
  CGFloat dampedOmega = omega * sqrt(MAX(CAVZero, CAVOne - damping * damping));
  CGFloat envelope = exp(-damping * omega * elapsed);
  CGFloat value = CAVOne - envelope * (cos(dampedOmega * elapsed) +
                                        (damping * omega / MAX(dampedOmega, CAVAnimationTolerance)) * sin(dampedOmega * elapsed));
  return MIN(CAVOne, MAX(CAVZero, value));
}
- (NSPoint)centerAtProgress:(CGFloat)progress {
  NSPoint source = NSMakePoint(NSMidX(self.sourceScreenRect), NSMidY(self.sourceScreenRect));
  NSPoint target = NSMakePoint(NSMidX(self.targetScreenRect), NSMidY(self.targetScreenRect));
  CGFloat apex = MAX(source.y, target.y) + CAVArcApex;
  NSPoint control = NSMakePoint((source.x + target.x) * CAVHalf,
                                CAVTwo * apex - (source.y + target.y) * CAVHalf);
  CGFloat inverse = CAVOne - progress;
  return NSMakePoint(inverse * inverse * source.x + CAVTwo * inverse * progress * control.x + progress * progress * target.x,
                     inverse * inverse * source.y + CAVTwo * inverse * progress * control.y + progress * progress * target.y);
}
- (NSRect)motionFrameForProgress:(CGFloat)progress {
  NSPoint center = [self centerAtProgress:progress];
  CGFloat width = NSWidth(self.sourceScreenRect) +
                  (NSWidth(self.targetScreenRect) - NSWidth(self.sourceScreenRect)) * progress;
  CGFloat height = NSHeight(self.sourceScreenRect) +
                   (NSHeight(self.targetScreenRect) - NSHeight(self.sourceScreenRect)) * progress;
  return NSMakeRect(center.x - width * CAVHalf, center.y - height * CAVHalf, width, height);
}
- (void)renderProgress:(CGFloat)progress {
  progress = MIN(CAVOne, MAX(CAVZero, progress));
  NSString *topology = CAVScreenTopologyKey();
  if (![topology isEqualToString:self.screenTopologyKey]) [self rebuildReplicants];
  NSRect motionFrame = [self motionFrameForProgress:progress];
  for (CAVScreenReplicant *replicant in self.replicants) [replicant setMotionFrame:motionFrame progress:progress];
}
- (void)startTransitionToProgress:(CGFloat)target {
  if (self.reducedMotion || !self.sourceImage || !self.targetImage) {
    if (target > CAVHalf) [self.helperPanel orderFront:nil];
    else [self cleanup];
    return;
  }
  if (self.replicants.count == CAVZero) [self rebuildReplicants];
  self.animationStartProgress = target > CAVHalf ? CAVZero : CAVOne;
  self.animationTargetProgress = target;
  self.animationStartedAt = CACurrentMediaTime();
  [self renderProgress:self.animationStartProgress];
  for (CAVScreenReplicant *replicant in self.replicants) [replicant orderFront];
  [self.animationTimer invalidate];
  self.animationTimer = [NSTimer scheduledTimerWithTimeInterval:CAVOne / CAVAnimationFrameRate
                                                          target:self
                                                        selector:@selector(animationTick:)
                                                        userInfo:nil
                                                         repeats:YES];
}
- (void)animationTick:(NSTimer *)timer {
  CGFloat eased = [self springProgressForElapsed:CACurrentMediaTime() - self.animationStartedAt];
  CGFloat progress = self.animationStartProgress +
                     (self.animationTargetProgress - self.animationStartProgress) * eased;
  [self renderProgress:progress];
  if (fabs(self.animationTargetProgress - progress) > CAVAnimationTolerance) return;
  [self.animationTimer invalidate];
  self.animationTimer = nil;
  [self renderProgress:self.animationTargetProgress];
  for (CAVScreenReplicant *replicant in self.replicants) [replicant orderOut];
  if (self.animationTargetProgress > CAVHalf) [self.helperPanel orderFront:nil];
  else [self cleanup];
}
- (void)retainDragSession:(NSDraggingSession *)session { self.dragSession = session; }
- (void)dragDidBegin {
  self.dragging = YES;
  [self.arrowTimer invalidate];
  self.arrowTimer = nil;
  [self.arrowView.layer removeAnimationForKey:@"cavalry-handoff-arrow"]; self.arrowView.layer.transform = CATransform3DIdentity;
  self.helperPanel.ignoresMouseEvents = YES;
}
- (void)dragDidEndWithOperation:(NSDragOperation)operation atScreenPoint:(NSPoint)screenPoint {
  self.dragging = NO;
  self.dragSession = nil;
  self.helperPanel.ignoresMouseEvents = NO;
  [self.helperPanel orderFront:nil];
  if (!self.reducedMotion) [self scheduleArrowCycleAfter:CAVArrowIdleDuration];
  /* 只有真实 System Settings 主窗口的完整窗口区域才会触发重试。 */
  NSRect currentSettingsFrame = CAVSystemSettingsWindowFrame();
  if (!NSIsEmptyRect(currentSettingsFrame)) self.settingsFrame = currentSettingsFrame;
  BOOL copyAccepted = operation == NSDragOperationCopy;
  BOOL endedInsideSettings = !NSIsEmptyRect(currentSettingsFrame) &&
                             NSPointInRect(screenPoint, currentSettingsFrame);
  if (copyAccepted && endedInsideSettings) {
    [self sendOutcome:CAVOutcomeRetryRequested terminal:NO];
  }
}
- (void)finishWithReverse:(BOOL)reverse {
  [self sendOutcome:CAVZero terminal:YES];
  if (reverse && !self.reducedMotion && self.sourceImage && self.targetImage) {
    [self updateTargetGeometry];
    [self.helperPanel orderOut:nil];
    [self startTransitionToProgress:CAVZero];
    return;
  }
  [self cleanup];
}
- (void)cleanup {
  [self.animationTimer invalidate];
  [self.locateTimer invalidate];
  [self.targetTrackingTimer invalidate];
  [self.arrowTimer invalidate];
  self.animationTimer = nil;
  self.locateTimer = nil;
  self.targetTrackingTimer = nil;
  self.arrowTimer = nil;
  self.dragSession = nil;
  for (CAVScreenReplicant *replicant in self.replicants) [replicant orderOut];
  [self.replicants removeAllObjects];
  [self.helperPanel orderOut:nil];
  [self.arrowPanel orderOut:nil];
  [self.helperPanel removeChildWindow:self.arrowPanel];
  self.helperPanel.contentView = nil; self.arrowPanel.contentView = nil;
  self.helperPanel = nil; self.arrowPanel = nil;
  self.dragView = nil;
  self.arrowView = nil;
  self.sourceImage = nil;
  self.targetImage = nil;
  if (CAVActiveCoordinator == self) CAVActiveCoordinator = nil;
}
@end
void cavalry_permission_handoff_start(void *nativeView, double x, double y, double width, double height, double viewportWidth, double viewportHeight, bool hasSourceRect, CAVPermissionHandoffCallback callback, void *context) {
  void (^start)(void) = ^{
    if (CAVActiveCoordinator) {
      [CAVActiveCoordinator sendOutcome:CAVOutcomeDismissed terminal:YES];
      [CAVActiveCoordinator cleanup];
    }
    NSView *view = (__bridge NSView *)nativeView;
    NSRect sourceRect = NSMakeRect(x, y, width, height);
    CAVActiveCoordinator = [[CAVPermissionHandoffCoordinator alloc]
      initWithView:view
        sourceRect:sourceRect
     viewportWidth:viewportWidth
    viewportHeight:viewportHeight
     hasSourceRect:hasSourceRect
          callback:callback
           context:context];
    [CAVActiveCoordinator begin];
  };
  if (NSThread.isMainThread) start();
  else dispatch_sync(dispatch_get_main_queue(), start);
}
void cavalry_permission_handoff_finish(bool reverse) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [CAVActiveCoordinator finishWithReverse:reverse];
  }); }
