#!/usr/bin/env osascript

-- Expand all menus and panels in Cavalry for comprehensive UI capture

on run
    tell application "Cavalry"
        activate
        delay 1
    end tell
    
    tell application "System Events"
        tell process "Cavalry"
            delay 2
            
            -- Menu bar menus
            tell menu bar 1
                try
                    click menu item "File" of menu 1
                    delay 0.5
                    key code 53 -- Escape
                    delay 0.3
                end try
                
                try
                    click menu item "Edit" of menu 1
                    delay 0.5
                    key code 53
                    delay 0.3
                end try
                
                try
                    click menu item "View" of menu 1
                    delay 0.5
                    key code 53
                    delay 0.3
                end try
                
                try
                    click menu item "Help" of menu 1
                    delay 0.5
                    key code 53
                    delay 0.3
                end try
            end tell
            
            -- Open key panels using keyboard shortcuts
            -- Library (Cmd+1)
            key code 83 using command down
            delay 1
            
            -- Inspector (Cmd+2)
            key code 84 using command down
            delay 1
            
            -- Timeline (Cmd+3)
            key code 85 using command down
            delay 1
            
            -- Preferences (Cmd+,)
            key code 41 using command down
            delay 1
            key code 53 -- Close preferences
            delay 0.3
            
            -- Give UI time to settle
            delay 2
        end tell
    end tell
    
    log "Menu expansion complete"
end run
