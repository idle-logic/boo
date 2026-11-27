# boo-migrate (Kiro Power)

Install this power in Kiro to give any agent Boo's migration engine and proof certificates.

1. In Kiro, open Powers and add this folder (`powers/boo-migrate`), or copy `mcp.json` into your workspace's `.kiro/settings/mcp.json`.
2. Ask the agent: "Raise this export and prove nothing was lost", with a CSV open.
3. The agent calls `boo_raise_csv`, shows what was hidden, and ends with the certificate's verdict and seal.

Tools: `boo_raise_csv`, `boo_check_changes`, `boo_find_workarounds`, `boo_certify_sample`, `boo_verify_certificate`, `boo_sample_old_app`.
