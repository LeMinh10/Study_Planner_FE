# Study Planner logo preparation

- Tool: built-in `imagegen`, edit mode with the user-supplied logo as the reference.
- Output: `src/assets/studyplanner-logo.png`, PNG with alpha transparency.
- Usage: shared `Brand` component; 120px on student authentication pages, 44px in the student sidebar.

## Final prompt

Use case: background-extraction. Edit target: the user's most recent attached Study Planner illustration, showing a blue ring-bound calendar with two checkmarks, blue and green books, green leaves, a blue clock with yellow hand, and small yellow accent strokes. Prepare this exact supplied logo as a website PNG asset. Remove only the outside white/off-white background and the pale cast shadow under the objects to create genuine alpha transparency. Keep the illustration itself unchanged: same shapes, arrangement, perspective, linework, colors, number and position of objects, rings, squares, and clock hands. Preserve white calendar pages, white clock face, white checkmarks, and white book pages as opaque white; they are part of the illustration, not the background. Do not redesign, stylize, add lettering, add objects, or replace the logo. Trim the excessive empty space so the existing mark is centered and occupies about 90% of the canvas, with a small safe transparent margin on all sides. Output a clean sharp square transparent PNG suitable for display at 112px on the login form and 44px beside the sidebar wordmark.
