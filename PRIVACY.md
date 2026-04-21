# Privacy Policy — NextDNS Reporter

**Last updated:** April 2026  
**Extension version:** 1.1.0  
**Author:** Jean-Thomas Runser

---

## Summary

NextDNS Reporter is a browser extension that adds a "Request unblocking" button
on pages blocked by NextDNS. This policy explains what data is collected,
how it is used, and what is never collected.

---

## What data is collected

NextDNS Reporter only collects data **when you explicitly click the "Send request"
button** on a NextDNS block page. The following information is then sent to the
Formspree endpoint configured by the network administrator:

| Field | Source | Purpose |
|---|---|---|
| Identity (name or email) | Provided by user or detected via Google account | Identify the requester |
| Blocked domain | Page title / URL | Identify what to unblock |
| Full URL | Browser address bar (`location.href`) | Provide context |
| Referrer URL | `document.referrer` | Show where the link came from |
| Block reason | NextDNS block page DOM (`#lists`) | Show which blocklist triggered |
| Context chips | User selection | Categorize the request |
| Comment | User input | Free-form explanation |
| Operating system | User agent string | Technical context |
| Browser | User agent string | Technical context |
| Date and time | Browser clock | Timestamp the request |
| User agent | `navigator.userAgent` | Full technical diagnostic |

---

## What data is NOT collected

- **No browsing history** — the extension script exits immediately on any page
  that is not a NextDNS block page. It does not read, monitor, or transmit
  any information from normal web pages.
- **No tracking** — no analytics, no telemetry, no usage statistics.
- **No persistent tracking identifiers** — the identity stored locally is
  provided voluntarily by the user and can be cleared at any time.
- **No passwords, payment data, or sensitive personal information.**

---

## Google account identity (chrome.identity permission)

The extension requests the `identity` permission to optionally read the email
address of the Google account signed into Chrome. This is used **only** to
pre-fill the identity field in the report form, so the network administrator
knows who submitted the request.

- This is entirely optional — you can decline and enter your name manually.
- The email is never stored by the extension unless you check "Remember".
- The email is never shared with third parties other than the configured
  Formspree endpoint (which belongs to your network administrator).

---

## Local storage

The extension stores the following data locally in your browser
(`chrome.storage.local`):

| Key | Content | Purpose |
|---|---|---|
| `ndns_endpoint` | Formspree URL | Where to send reports |
| `ndns_username` | Name or email | Pre-fill identity field |
| `ndns_oneclic` | Boolean | One-click mode preference |
| `ndns_reported` | Map of domains + timestamps | Anti-duplicate (48h) |

This data stays on your device. It is never sent anywhere except when you
explicitly submit a report (only the fields listed above, to your Formspree endpoint).

You can clear all stored data at any time via the History page in the extension
options, or by clearing your browser's extension data.

---

## Third-party services

### Formspree
Reports are sent to Formspree (formspree.io), a third-party form service.
The endpoint is configured by your network administrator.
Formspree's privacy policy applies to data received through their service:
https://formspree.io/legal/privacy-policy

### NextDNS
This extension reads data from the NextDNS block page DOM (blocked domain,
block reason). It does not interact with the NextDNS API directly.
NextDNS privacy policy: https://nextdns.io/privacy

---

## Data retention

The extension stores up to 30 report history entries locally. Each entry contains
only the domain name and timestamp. History can be cleared at any time.
There is no server-side data retention — the extension has no backend.

---

## Your rights

You can at any time:
- View stored data: open the extension options → History
- Clear stored data: open the extension options → History → "Clear history"
- Remove the identity: open the extension options → Settings → clear the name field
- Uninstall the extension: removes all stored data automatically

---

## Contact

For questions about this privacy policy:
- GitHub: https://github.com/jeantoroot/NextDNS-Reporter/issues
- Email: contact.runser68@gmail.com

---

## Changes to this policy

Any significant changes to this policy will be noted in the extension's
changelog and reflected in the "Last updated" date above.
