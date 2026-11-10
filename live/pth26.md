# Feature sprint prompt (from vela-slides PR)

/goal i want to add some improvements, listed below. I may add new ones later.
for each one, grill me to get a spec, show visual previews 
implement ensuring maximum qa and absolutely zero security issues
this goes directly to production so zero tolerance for errors
use sub agents, pick proper models for tasks, 
always show before and after for visual changes, show implemented functional preview before core review and security review

new feature
-i want to be able to add many images to a slide like up to 10 , and they keep stacking nicely so I can use a slide for a story zooming in, navigating each image, we should add optional titles for images, only shown when zoom out, the goal is to replace live demos, 
great UX for deck author and while presenting for audience


# Simple Sandbox Audit

**WARNING: it may send sensitive information to your agent AI provider**



# Vela Slides Weekly Vuln Scan

create 3 sub agents, *all doing exactly the same*, 
each agent works for 5 mins straight searching and confirming any vulns (check our security bounty targets)
*important: only vulns that were introduced by any change since last last week, always assume any security fix during the period may not be 100% effective*

non stop for 5 mins, enforce using time stamps and no sleep tricks, i will audit everything, 

instruct agents to save periodic progress snapshots and use those to periodically report progress/updates to me
do your final assessment and tests if needed to double check any reported findings
