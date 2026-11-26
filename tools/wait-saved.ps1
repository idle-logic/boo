# Test helper: wait until the demo form says how many clients were saved, then print it.
param([int]$Want = 5, [int]$Seconds = 180)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$any = [System.Windows.Automation.Condition]::TrueCondition
$deadline = (Get-Date).AddSeconds($Seconds)
$last = ''
while ((Get-Date) -lt $deadline) {
  foreach ($w in $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $any)) {
    if ($w.Current.Name -notlike '*New client*') { continue }
    foreach ($el in $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, $any)) {
      $n = $el.Current.Name
      if ($n -like 'Saved *clients added*' -or $n -like 'Saved *client added*') {
        if ($n -ne $last) { Write-Output "$(Get-Date -Format HH:mm:ss) $n"; $last = $n }
        if ($n -like "* $Want clients added*") { exit 0 }
      }
    }
  }
  Start-Sleep -Seconds 2
}
Write-Output "timed out; last status: $last"
exit 1
