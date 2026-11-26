# Boo's hands. A long-running helper that reads one JSON command per line on
# stdin and answers with one JSON line on stdout.
#
#   {"cmd":"scan","title":"New client"}     list the form fields in that window
#   {"cmd":"fill","index":3,"value":"Mei"}  click into field 3 from the last scan and type
#   {"cmd":"press","index":9}               press the button at index 9
#
# It uses Windows UI Automation, the same layer screen readers use, so it
# works with any app that supports accessibility: browsers, desktop CRMs, old
# Windows software.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class HauntInput {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@
[void][HauntInput]::SetProcessDPIAware()

$A = [System.Windows.Automation.AutomationElement]
$Tree = [System.Windows.Automation.TreeScope]
$Any = [System.Windows.Automation.Condition]::TrueCondition
$CT = [System.Windows.Automation.ControlType]
$script:fields = @()
$script:window = $null

# Haunt's own windows are never a target.
$script:selfPid = [int]($env:HAUNT_PID)
function Find-Window([string]$title) {
  if (-not $title) {
    $w = $A::FromHandle([HauntInput]::GetForegroundWindow())
    if ($w -and $w.Current.ProcessId -eq $script:selfPid) { return $null }
    return $w
  }
  foreach ($w in $A::RootElement.FindAll($Tree::Children, $Any)) {
    if ($w.Current.ProcessId -eq $script:selfPid) { continue }
    if ($w.Current.Name.Contains($title)) { return $w }
  }
  return $null
}

# Labels from the page, used when a field has no accessible name of its own.
function Label-For($el) {
  $n = $el.Current.Name
  if ($n) { return $n }
  $h = $el.Current.HelpText
  if ($h) { return $h }
  return $el.Current.AutomationId
}

function Scan([string]$title) {
  # '@same' re-reads the window from the last scan, by its handle, never by title.
  $win = if ($title -eq '@same' -and $script:window) { $script:window } else { Find-Window $title }
  if (-not $win) { return @{ ok = $false; error = 'window not found' } }
  $script:window = $win
  $wanted = @($CT::Edit, $CT::ComboBox, $CT::CheckBox, $CT::RadioButton, $CT::Button)
  $list = @()
  # Browsers build their page tree on first request, so ask twice if the page looks empty.
  for ($try = 0; $try -lt 2; $try++) {
    $list = @()
    foreach ($el in $win.FindAll($Tree::Descendants, $Any)) {
      $c = $el.Current
      if ($wanted -notcontains $c.ControlType -or $c.IsOffscreen -or -not $c.IsEnabled) { continue }
      $r = $c.BoundingRectangle
      if ($r.IsEmpty -or $r.Width -lt 4) { continue }
      $list += ,$el
    }
    if (($list | Where-Object { $_.Current.ControlType -eq $CT::Edit }).Count -gt 1) { break }
    Start-Sleep -Milliseconds 400
  }
  $script:fields = $list
  $i = 0
  $out = foreach ($el in $list) {
    $c = $el.Current
    $r = $c.BoundingRectangle
    [pscustomobject]@{
      index = $i++
      type = ($c.ControlType.ProgrammaticName -replace 'ControlType\.', '')
      label = (Label-For $el)
      id = $c.AutomationId
      x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height
    }
  }
  return @{ ok = $true; window = $win.Current.Name; fields = @($out) }
}

function Escape-Keys([string]$text) {
  # SendKeys treats these as commands, so wrap each in braces.
  return ($text -replace '([+^%~(){}\[\]])', '{$1}')
}

function Fill([int]$index, [string]$value) {
  $el = $script:fields[$index]
  if (-not $el) { return @{ ok = $false; error = 'no such field' } }
  Bring-Into-View $el
  $hwnd = [IntPtr]$script:window.Current.NativeWindowHandle
  [void][HauntInput]::SetForegroundWindow($hwnd)
  $el.SetFocus()
  Start-Sleep -Milliseconds 60
  # Never type unless the form's own window is in front and the field has focus.
  # Keys go to whatever has focus, so this is what keeps Boo out of other apps.
  if ([HauntInput]::GetForegroundWindow() -ne $hwnd) { return @{ ok = $false; error = 'not-in-front' } }
  if (-not $el.Current.HasKeyboardFocus) { return @{ ok = $false; error = 'no-focus' } }
  $type = $el.Current.ControlType
  if ($type -eq $CT::ComboBox) {
    $picked = Select-Option $el $value
    if (-not $picked) {
      # Last resort: type the option's text, then close the list.
      [System.Windows.Forms.SendKeys]::SendWait((Escape-Keys $value))
      [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    }
  } else {
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
    foreach ($ch in $value.ToCharArray()) {
      # Stop at once if you switch apps while Boo is typing.
      if ([HauntInput]::GetForegroundWindow() -ne $hwnd) { return @{ ok = $false; error = 'not-in-front' } }
      [System.Windows.Forms.SendKeys]::SendWait((Escape-Keys ([string]$ch)))
      Start-Sleep -Milliseconds 12
    }
  }
  $now = ''
  try { $now = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {}
  return @{ ok = $true; value = $now }
}

# Open a drop-down, pick the option whose name matches, close it.
function Select-Option($el, [string]$value) {
  $expand = $null
  try { $expand = $el.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern) } catch {}
  if ($expand) { try { $expand.Expand(); Start-Sleep -Milliseconds 150 } catch {} }
  $want = $value.Trim().ToLower()
  $best = $null
  foreach ($item in $el.FindAll($Tree::Descendants, $Any)) {
    if ($item.Current.ControlType -ne $CT::ListItem) { continue }
    $name = $item.Current.Name.Trim().ToLower()
    if ($name -eq $want) { $best = $item; break }
    if (-not $best -and $name.Contains($want)) { $best = $item }
  }
  if ($best) {
    try { $best.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { $best = $null }
  }
  if ($expand) { try { $expand.Collapse() } catch {} }
  return [bool]$best
}

function Press([int]$index) {
  $el = $script:fields[$index]
  if (-not $el) { return @{ ok = $false; error = 'no such field' } }
  try {
    $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
  } catch {
    $hwnd = [IntPtr]$script:window.Current.NativeWindowHandle
    [void][HauntInput]::SetForegroundWindow($hwnd)
    $el.SetFocus()
    if ([HauntInput]::GetForegroundWindow() -ne $hwnd) { return @{ ok = $false; error = 'not-in-front' } }
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  }
  return @{ ok = $true }
}

# Everything Boo can see and use in a window: buttons, links, fields, tabs,
# list items and text, with names, values and positions. Properties are fetched
# in one cached request, so even a large web app reads quickly. Inside a
# browser, only the page is read, not the browser's own buttons.
$script:kinds = @{
  'Button' = 'button'; 'Hyperlink' = 'link'; 'Edit' = 'textbox'; 'ComboBox' = 'select'; 'CheckBox' = 'checkbox'
  'RadioButton' = 'radio'; 'TabItem' = 'tab'; 'ListItem' = 'item'; 'MenuItem' = 'menuitem'; 'Text' = 'text'
  'DataItem' = 'cell'; 'TreeItem' = 'item'; 'Header' = 'text'; 'HeaderItem' = 'text'
}
function Observe([string]$title, [int]$max) {
  $win = if ($title -eq '@same' -and $script:window) { $script:window } else { Find-Window $title }
  if (-not $win) { return @{ ok = $false; error = 'window not found' } }
  $script:window = $win
  $cache = New-Object System.Windows.Automation.CacheRequest
  foreach ($p in @($A::NameProperty, $A::ControlTypeProperty, $A::BoundingRectangleProperty, $A::IsOffscreenProperty,
                   $A::IsEnabledProperty, $A::IsPasswordProperty, $A::AutomationIdProperty, $A::HelpTextProperty,
                   [System.Windows.Automation.ValuePattern]::ValueProperty,
                   [System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty)) { $cache.Add($p) }
  $cache.TreeScope = $Tree::Element -bor $Tree::Descendants
  # In a browser, read only the web page.
  $root = $win
  $doc = $win.FindFirst($Tree::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $CT::Document)))
  if ($doc) { $root = $doc }
  $act = $cache.Activate()
  try { $all = $root.FindAll($Tree::Descendants, $Any) } finally { $act.Dispose() }
  $items = @()
  $i = 0
  foreach ($el in $all) {
    $c = $el.Cached
    $kind = $c.ControlType.ProgrammaticName -replace 'ControlType\.', ''
    $role = $script:kinds[$kind]
    if (-not $role) { continue }
    # Text that is scrolled out of view can still be read, like a screen reader does.
    # Things to press or type into must be on screen.
    $offscreen = [bool]$c.IsOffscreen
    if ($offscreen -and @('text', 'item', 'cell') -notcontains $role) { continue }
    $r = $c.BoundingRectangle
    if ($r.IsEmpty -or $r.Width -lt 2 -or $r.Height -lt 2) { continue }
    if ($c.IsPassword) { $role = 'password' }
    $name = $c.Name
    if (-not $name) { $name = $c.HelpText }
    $value = $null
    try { $value = $el.GetCachedPropertyValue([System.Windows.Automation.ValuePattern]::ValueProperty) } catch {}
    if ($value -eq $A::NotSupported) { $value = $null }
    if ($role -eq 'password') { $value = $null }
    if (($role -eq 'text' -or $role -eq 'item' -or $role -eq 'cell') -and -not $name) { continue }
    $selected = $false
    try {
      $sel = $el.GetCachedPropertyValue([System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty)
      if ($sel -ne $A::NotSupported) { $selected = [bool]$sel }
    } catch {}
    $items += [pscustomobject]@{
      index = $i; role = $role; name = [string]$name; value = $value; selected = $selected; enabled = $c.IsEnabled; offscreen = $offscreen
      x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height; el = $el
    }
    $i++
    if ($items.Count -ge $max) { break }
  }
  $script:fields = @($items | ForEach-Object { $_.el })
  $out = @($items | ForEach-Object {
    [pscustomobject]@{ index = $_.index; role = $_.role; name = $_.name; value = $_.value; selected = $_.selected; enabled = $_.enabled; offscreen = $_.offscreen; x = $_.x; y = $_.y; w = $_.w; h = $_.h }
  })
  return @{ ok = $true; window = $win.Current.Name; url = (Read-Url $win); elements = $out }
}

# The address of the page in a browser window, from its address bar. Empty for other apps.
function Read-Url($win) {
  try {
    $cond = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $CT::Edit)
    foreach ($e in $win.FindAll($Tree::Descendants, $cond)) {
      if ($e.Current.Name -match 'Address|address and search|Search or enter') {
        return $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
      }
    }
  } catch {}
  return ''
}

# Click anything: the element's own action when it has one, else a real mouse click on its centre.
function Bring-Into-View($el) {
  try { $el.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView(); Start-Sleep -Milliseconds 120 } catch {}
}

function Click-Element([int]$index) {
  $el = $script:fields[$index]
  if (-not $el) { return @{ ok = $false; error = 'no such element' } }
  Bring-Into-View $el
  $hwnd = [IntPtr]$script:window.Current.NativeWindowHandle
  [void][HauntInput]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 60
  if ([HauntInput]::GetForegroundWindow() -ne $hwnd) { return @{ ok = $false; error = 'not-in-front' } }
  foreach ($pattern in @([System.Windows.Automation.InvokePattern]::Pattern, [System.Windows.Automation.SelectionItemPattern]::Pattern, [System.Windows.Automation.TogglePattern]::Pattern)) {
    try {
      $p = $el.GetCurrentPattern($pattern)
      if ($pattern -eq [System.Windows.Automation.InvokePattern]::Pattern) { $p.Invoke() }
      elseif ($pattern -eq [System.Windows.Automation.SelectionItemPattern]::Pattern) { $p.Select() }
      else { $p.Toggle() }
      return @{ ok = $true; how = 'pattern' }
    } catch {}
  }
  $r = $el.Current.BoundingRectangle
  [HauntInput]::Click([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2))
  return @{ ok = $true; how = 'mouse' }
}

# What the person can see in the foreground window, as plain text lines, top to
# bottom. Password fields are never read. Haunt's own window is skipped.
function Read-Screen([int]$skipPid) {
  $win = $A::FromHandle([HauntInput]::GetForegroundWindow())
  if (-not $win) { return @{ ok = $false; error = 'no window' } }
  if ($win.Current.ProcessId -eq $skipPid) { return @{ ok = $true; title = ''; lines = @() } }
  $kinds = @($CT::Text, $CT::Hyperlink, $CT::ListItem, $CT::DataItem, $CT::HeaderItem, $CT::TreeItem, $CT::TabItem, $CT::Edit)
  $items = @()
  foreach ($el in $win.FindAll($Tree::Descendants, $Any)) {
    $c = $el.Current
    if ($kinds -notcontains $c.ControlType -or $c.IsOffscreen -or $c.IsPassword) { continue }
    $text = $c.Name
    if ($c.ControlType -eq $CT::Edit) {
      try { $text = $c.Name + ': ' + $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {}
    }
    if (-not $text -or $text.Trim().Length -lt 2) { continue }
    $r = $c.BoundingRectangle
    $items += [pscustomobject]@{ y = [int]$r.Y; x = [int]$r.X; t = $text.Trim() }
    if ($items.Count -ge 400) { break }
  }
  $seen = @{}
  $lines = foreach ($i in ($items | Sort-Object y, x)) {
    $t = if ($i.t.Length -gt 160) { $i.t.Substring(0, 160) } else { $i.t }
    if ($seen.ContainsKey($t)) { continue }
    $seen[$t] = $true
    $t
  }
  return @{ ok = $true; title = $win.Current.Name; lines = @($lines) }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $msg = $line | ConvertFrom-Json
    switch ($msg.cmd) {
      'scan' { $res = Scan $msg.title }
      'fill' { $res = Fill $msg.index $msg.value }
      'press' { $res = Press $msg.index }
      'read' { $res = Read-Screen ([int]$msg.skipPid) }
      'observe' { $res = Observe $msg.title ([int]($(if ($msg.max) { $msg.max } else { 260 }))) }
      'click' { $res = Click-Element $msg.index }
      default { $res = @{ ok = $false; error = 'unknown command' } }
    }
  } catch {
    $res = @{ ok = $false; error = $_.Exception.Message }
  }
  $res.id = $msg.id
  [Console]::Out.WriteLine(($res | ConvertTo-Json -Depth 5 -Compress))
  [Console]::Out.Flush()
}
