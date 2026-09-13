# Archefict - Product

> Last updated: September 01, 2026
> Planned feature vision.

AI platform for roleplay, simulation and interactive worlds. For web, mobile and desktop.

Origin: running AI RPGs with campaign data spread across Fibery, Notion and Obsidian + Dataview. Archefict simplifies that setup so both the AI and the user can update and visualize the world's state, with Obsidian-like openness for plugins.

## Users
* OAuth login and sign-up 
* User-provided AI API keys
* Can manage his spendings by setting which part of the app uses which specific model

## Campaigns
* Fully editable timeline
* Editable narrative entries render sanitized Markdown
* Separate timeline from chat (narrative from meta—sheets/timeline update, off-immersion questions, etc.)
* Plugins tied to a campaign
* Editable sheets
* Optional cloud (default, otherwise local with IndexedDB)
* Permissive UI structuring
* Import and export

## Sheets
* Rich text: tables, images and references. Stored as structure, never as markup
* Fields written inline as you type, kept structured: `::` sets one, `{{ }}` shows one, `[[ ]]` links a sheet
* A field can belong to another sheet, so a fact is written once and shown anywhere

## AI
* On-demand code execution
* LLM can use typed tools supplied by the application or plugins
* Sheets are cleanly serialized; compact machine representation
* Should query campaign sheets strategically
* No image generation, user can place images in chat/HUD/sheets freely for now
* One AI focuses on the context and finishes with a handoff that a background model will execute

## Plugins
* Enabled/installed per campaign
* Advanced application tools available via code
* Custom views, timeline components, chat input control, HUDs, overlays and more
* Custom sheet parts, and whole sheets a plugin draws itself
* No access to user data, other campaigns, browser cookies or account secrets
* User can download and import one outside our cloud with an warning

## Scenarios
* Set of rules and required plugins
* Custom initial campaign form

## Marketplace
* List of installable user plugins and scenarios
* Scanned or verified only 
* Maybe automatic verification one day (e.g. checking libraries, etc.)
