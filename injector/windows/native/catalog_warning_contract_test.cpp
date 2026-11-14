/*
 * [INPUT]: Windows 2.8.1 log_msg布局、17官方catalog fixture与生产warning适配器。
 * [OUTPUT]: 三语/任意安装根的精确正例及未知producer、英语源、未知路径、坏包和异常单次转发合同。
 * [POS]: 无厂商DLL/无文件的Api启动warning合同；不把合成payload当作实机日志。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "catalog_warning_adapter.h"
#include <cstdio>
#include <stdexcept>
#include <vector>
namespace {
using namespace native_windows_catalog_warning;
constexpr std::string_view catalogs[]={
    "Definitions/Translation/appStrings","Definitions/Translation/nodeStrings","Learn/Guides/Translation/strings",
    "Plugins/Bilateral Blur Filter/Translation/strings","Plugins/Box Blur Filter/Translation/strings",
    "Plugins/Bulge Filter/Translation/strings","Plugins/Chroma Key Filter/Translation/strings",
    "Plugins/Directional Blur Filter/Translation/strings","Plugins/Erosion Filter/Translation/strings",
    "Plugins/Gaussian Blur Filter/Translation/strings","Plugins/Grain Filter/Translation/strings",
    "Plugins/Light Sweep Filter/Translation/strings","Plugins/Polar Coordinates Filter/Translation/strings",
    "Plugins/Ripple Filter/Translation/strings","Plugins/Spherise Filter/Translation/strings",
    "Plugins/Twist Filter/Translation/strings","Plugins/Zoom Blur Filter/Translation/strings"};
int calls=0,proofCalls=0;const void *received=nullptr;bool originalThrows=false;
void original(void *logger,const void *message,bool,bool){
    ++calls;received=message;
    if(logger!=reinterpret_cast<void*>(0x28))throw std::logic_error("logger changed");
    if(originalThrows)throw std::runtime_error("original");
}
void require(bool value,const char *label){if(!value)throw std::logic_error(label);}
std::string warning(std::string_view root,std::string_view catalog,std::string_view locale){
    return std::string(kPrefix)+std::string(root)+"\\assets\\"+std::string(catalog)+"_"+std::string(locale)+".translation.json"+std::string(kSuffix);
}
Message message(const std::string &payload,int level=3){
    Message value{};value.prefix[0]=std::byte{0x28};std::memcpy(value.prefix+0x10,&level,sizeof(level));
    value.payload=payload.data();value.payloadSize=payload.size();return value;
}
}
int main(){
    try{
        constexpr std::uintptr_t apiBase=0x180000000ULL;
        const std::uintptr_t approvedFrames[]={apiBase+kWarningProducerReturn};
        require(approvedWarningCaller(apiBase+kLoggerCallReturn,approvedFrames,1,apiBase),"official warning producer chain rejected");
        require(!approvedWarningCaller(apiBase+kLoggerCallReturn+1,approvedFrames,1,apiBase),"adjacent logger caller admitted");
        const std::uintptr_t unrelatedFrames[]={apiBase+kWarningProducerReturn+1};
        require(!approvedWarningCaller(apiBase+kLoggerCallReturn,unrelatedFrames,1,apiBase),"adjacent producer frame admitted");
        const PackProof proofs[]={{"zh-Hans","zh-Hans","",1},{"zh-Hant","zh-Hant","",1},{"ja_JP","ja","",1}};
        for(const auto &proof:proofs)for(const auto root:{"D:\\cavalry","E:\\Apps\\Cavalry 2.8","E:\\动画\\Cavalry"})for(const auto catalog:catalogs){
            const auto text=warning(root,catalog,proof.locale);auto value=message(text);const auto before=value;
            calls=proofCalls=0;
            require(forward(original,reinterpret_cast<void*>(0x28),&value,true,false,true,root,proof,catalogs,17,
                []{++proofCalls;return true;}),"known approved target warning was not quiet");
            require(calls==0 && proofCalls==1 && std::memcmp(&value,&before,sizeof(value))==0,"quiet mutated/forwarded source");
        }
        const auto &proof=proofs[0];const std::string root="F:\\Custom\\Cavalry";
        const auto positive=warning(root,catalogs[0],proof.locale);
        const std::vector<std::string> negatives={
            warning(root,catalogs[0],"en-GB"),warning(root,catalogs[0],"zh-Hant"),
            warning(root,"Plugins/User Filter/Translation/strings",proof.locale),
            warning(root+"2",catalogs[0],proof.locale),warning(root,"../Definitions/Translation/appStrings",proof.locale),
            positive+" extra",std::string("User says: ")+positive,"No source locale file at example",
            warning(root,catalogs[0],proof.locale)+"\n", "Welcome to Cavalry."};
        for(const auto &text:negatives){
            auto value=message(text);calls=proofCalls=0;
            require(!forward(original,reinterpret_cast<void*>(0x28),&value,true,false,true,root,proof,catalogs,17,
                []{++proofCalls;return true;}),"unknown warning was quiet");
            require(calls==1 && received==&value && proofCalls==0,"unknown warning did not forward exactly once");
        }
        auto value=message(positive);calls=proofCalls=0;
        require(!forward(original,reinterpret_cast<void*>(0x28),&value,true,false,true,root,proof,catalogs,17,
            []{++proofCalls;return false;}) && calls==1 && proofCalls==1,"missing/drifted pack was quiet");
        calls=0;
        require(!forward(original,reinterpret_cast<void*>(0x28),reinterpret_cast<void*>(1),true,false,false,
            root,proof,catalogs,17,[]{throw std::logic_error("unknown caller read proof");return true;}) && calls==1,
            "unknown caller read message");
        for(const int level:{0,1,2,4,5,6}){
            auto other=message(positive,level);calls=proofCalls=0;
            require(!forward(original,reinterpret_cast<void*>(0x28),&other,true,false,true,root,proof,catalogs,17,
                []{++proofCalls;return true;}) && calls==1 && proofCalls==0,"non-warning changed");
        }
        for(const auto flags:{std::pair<bool,bool>{false,false},{true,true}}){
            calls=proofCalls=0;
            require(!forward(original,reinterpret_cast<void*>(0x28),&value,flags.first,flags.second,true,
                root,proof,catalogs,17,[]{++proofCalls;return true;}) && calls==1 && proofCalls==0,
                "disabled logging or backtrace capture changed");
        }
        calls=0;
        require(!forward(original,reinterpret_cast<void*>(0x28),&value,true,false,true,root,proof,catalogs,17,
            []()->bool{throw std::runtime_error("proof failed");}) && calls==1,"proof exception swallowed warning");
        originalThrows=true;calls=0;
        try{forward(original,reinterpret_cast<void*>(0x28),&value,true,false,true,root,proof,catalogs,17,[]{return false;});return 2;}
        catch(const std::runtime_error &){require(calls==1,"original exception duplicated");}
        std::puts("153 approved target warnings and strict source/path/locale/level/pack/forward-once negatives passed");
    }catch(const std::exception &error){std::fprintf(stderr,"%s\n",error.what());return 1;}
}
