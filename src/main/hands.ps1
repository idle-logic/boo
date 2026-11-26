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
}
"@
[void][HauntInput]::SetProcessDPIAware()

$A = [System.Windows.Automation.AutomationElement]
$Tree = [System.Windows.Automation.TreeScope]
$Any = [System.Windows.Automation.Condition]::TrueCondition
$CT = [System.Windows.Automation.ControlType]
$script:fields = @()
$script:window = $null

function Find-Window([string]$title) {
  if (-not $title) { return $A::FromHandle([HauntInput]::GetForegroundWindow()) }
  foreach ($w in $A::RootElement.FindAll($Tree::Children, $Any)) {
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
      default { $res = @{ ok = $false; error = 'unknown command' } }
    }
  } catch {
    $res = @{ ok = $false; error = $_.Exception.Message }
  }
  $res.id = $msg.id
  [Console]::Out.WriteLine(($res | ConvertTo-Json -Depth 5 -Compress))
  [Console]::Out.Flush()
}
