# Final Year Project Log

Student: Daniel Asouzu
Project: DKCleanEdit

-------------------------------------------------------

20 January 2026
Researched ideas for the final year project and decided to build
a web platform for a sneaker cleaning service called DKCleanEdit.
Looked into technologies suitable for the system including HTML,
CSS, JavaScript, Firebase authentication and Firestore database.
Planned the main features including booking services, order
tracking and an admin dashboard.

27 January 2026
Designed the initial structure of the system and planned the
website layout. Created the project folder structure and started
building the navigation system and homepage layout using HTML and
CSS.

3 February 2026
Developed the main frontend pages including the homepage,
booking page and navigation bar. Implemented responsive styling
to ensure the website works across different screen sizes.

10 February 2026
Implemented user authentication using Firebase. Developed login
and registration pages allowing users to create accounts and log
into the system. Tested authentication functionality to ensure
user data was stored correctly in Firestore.

17 February 2026
Developed the booking system allowing customers to select the
type of service, location, date and time slot. Connected the
booking system to Firebase Firestore so booking information can
be stored and retrieved. Resolved an issue where service type
and price were not staying in sync, which was fixed by binding
both fields to the same state in app.js.

24 February 2026
Implemented the order tracking system so users can track the
progress of their orders. Created order stages including:
Booked, Received, Cleaning, Drying & Finish, Ready, Completed
and Cancelled.

3 March 2026
Improved the user interface and styling of the website using CSS.
Refined layout design, navigation links and card components to
improve usability and visual appearance. Also started developing
the admin dashboard where administrators can view and manage
customer orders, with the ability to update order stages.

10 March 2026
Developed the analytics dashboard for the admin system. Integrated
Chart.js to display business analytics such as total orders,
completed orders, cancelled orders, service popularity and order
locations. Connected analytics to Firebase so charts update based
on stored booking data.

11 March 2026
Updated the CSS styling across multiple pages and refined the
JavaScript logic in app.js. Improved the homepage layout and
booking page structure. Pushed the initial project version to
GitHub to begin version control tracking. Updated the project
log to reflect progress made to date.

12 March 2026
Added a visual progress bar to the customer orders page so users
can see at a glance what stage their order is at. Iterated on
the progress bar design across three commits to get the styling
and logic correct, as the initial version was not accurately
reflecting the order stage from Firestore.

18-19 March 2026
Carried out a significant redesign of the booking page UI and
the login page UI to improve visual consistency and match the
DKCleanEdit brand. Updated the service information displayed on
the booking page and fixed a bug where the service type and
price were not syncing correctly. Spent approximately three to
four hours across both days refining the CSS and testing the
updated layouts across screen sizes.

27 March 2026
Updated the tracking page to improve the order display and
user experience. Also updated the register feature, improving
the form validation and the way user data is written to
Firestore on account creation.

28-29 March 2026
Added a find order tab to the tracking page so users can search
for a specific booking by reference number. Implemented a
comment section allowing customers or admins to leave notes
against an order. These features add interactivity and
transparency to the order tracking experience.

1 April 2026
Added a map to the location selection on the booking page so
customers can visually confirm their collection or drop-off
point. Updated the image upload functionality so profile
pictures are stored correctly in Firebase Storage and linked
to the user's location record.

2 April 2026
Implemented email notifications using EmailJS so customers
receive a confirmation when their booking is placed. This fulfils a
key must-have requirement from the original project proposal.

7 April 2026
Implemented a today's schedule view inside the admin panel so
staff can see all bookings due on the current date at a glance.
Also added a booking map to the admin view so the geographic
spread of orders can be visualised. Refined the project
calendar by adding sprint 2 milestones and adjusting deadlines
to align with the remaining development time.

10 April 2026
Developed the settings page with a background colour
customisation feature, allowing users to toggle between light
and dark themes. This enhances UI personalisation and improves
accessibility for users who prefer different contrast levels.

-------------------------------------------------------

Next Steps
Complete user testing with 6 to 8 participants as planned in
the project proposal. Document findings and incorporate
feedback into final improvements. Write up the dissertation
including critical evaluation, reflection on methodology and
appendices. Fix any remaining bugs identified during testing.