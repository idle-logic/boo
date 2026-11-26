# Spike: list the form fields in the foreground window (or a window whose title
# contains -Title) with their labels and screen rectangles, using Windows UI
# Automation. Prints JSON.
param([string]$Title = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$win = $null
if ($Title) {
  $cond = [System.Windows.Automation.Condition]::TrueCondition
  foreach ($w in $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)) {
    if ($w.Current.Name -like "*$Title*") { $win = $w; break }
  }
} else {
  Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Fg { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); }
"@
  $win = [System.Windows.Automation.AutomationElement]::FromHandle([Fg]::GetForegroundWindow())
}
if (-not $win) { '{"error":"window not found"}'; exit }

$types = @(
  [System.Windows.Automation.ControlType]::Edit,
  [System.Windows.Automation.ControlType]::ComboBox,
  [System.Windows.Automation.ControlType]::Button,
  [System.Windows.Automation.ControlType]::CheckBox
)
$out = @()
$all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
foreach ($el in $all) {
  $c = $el.Current
  if ($types -notcontains $c.ControlType) { continue }
  if ($c.IsOffscreen) { continue }
  $r = $c.BoundingRectangle
  if ($r.IsEmpty -or $r.Width -lt 4) { continue }
  $out += [pscustomobject]@{
    type = $c.ControlType.ProgrammaticName -replace 'ControlType\.', ''
    name = $c.Name
    id = $c.AutomationId
    x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height
  }
}
[pscustomobject]@{ window = $win.Current.Name; fields = $out } | ConvertTo-Json -Depth 4 -Compress
