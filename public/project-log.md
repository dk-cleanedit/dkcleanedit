# Final Year Project Log

Student: Daniel Asouzu
Project: DKCleanedit

-------------------------------------------------------

20 January 2026
Researched potential ideas for the final year project and decided to develop a web platform for a sneaker cleaning service, DKCleanEdit. Investigated suitable technologies including HTML, CSS, JavaScript, Firebase Authentication and Firestore. Defined core system requirements such as booking services, order tracking and an admin dashboard.
Reflection:
This stage was important in setting a clear direction for the project. Early consideration of technologies helped avoid future compatibility issues. In hindsight, more time could have been spent comparing backend alternatives before committing to Firebase.
Plan for next week:
Design system structure and begin frontend layout.



27 January 2026
Designed the overall system architecture and planned the website layout. Created the initial folder structure and began implementing the navigation system and homepage using HTML and CSS.
Reflection:
Establishing a clear structure early improved development efficiency later. However, some layout decisions were revisited in later stages, showing that initial designs should remain flexible.
Plan for next week:
Develop core frontend pages and improve responsiveness.
February 2026 Core System Development


3 February 2026
Developed key frontend pages including the homepage, booking page and navigation bar. Implemented responsive design to ensure usability across devices.
Reflection:
Responsive design required iterative testing, highlighting the importance of designing with multiple screen sizes in mind from the beginning.
Plan for next week:
Implement user authentication.


10 February 2026
Implemented Firebase Authentication, including login and registration functionality. Ensured user data was correctly stored and retrieved from Firestore.
Reflection:
Working with Firebase simplified backend development but required careful handling of asynchronous operations. This improved my understanding of real-time database interactions.
Plan for next week:
Develop booking system and integrate database storage.

17 February 2026
Developed the booking system allowing users to select service type, location, date and time. Integrated Firestore to store booking data. Resolved an issue where service type and price were not syncing by binding both to a single state variable.
Reflection:
This issue highlighted the importance of maintaining a single source of truth in state management. Fixing it improved system reliability and reduced potential inconsistencies.
Plan for next week:
Implement order tracking functionality.

24 February 2026
Developed the order tracking system with multiple stages (Booked → Completed). Enabled users to monitor progress of their orders.
Reflection:
Designing clear status stages improved usability and transparency. Future improvements could include real-time updates rather than manual refresh.
Plan for next week:
Improve UI and begin admin dashboard.
March 2026 – Feature Expansion & UI Refinement

3 March 2026
Enhanced UI design and styling across the system. Began development of the admin dashboard to manage customer orders.
Reflection:
UI improvements significantly impacted usability. This emphasised the importance of user-centred design alongside functionality.
Plan for next week:
Develop analytics dashboard.

10 March 2026
Implemented an analytics dashboard using Chart.js. Displayed metrics such as total orders, completed orders and service popularity.
Reflection:
Integrating analytics added business value to the system. This demonstrated how data visualisation can support decision-making.
Plan for next week:
Refine frontend and begin version control tracking.

11–12 March 2026
Refined CSS and JavaScript logic. Added a progress bar for order tracking and iterated on its design to ensure accurate representation of order stages. Began using version control to track development.
Reflection:
Multiple iterations were required to achieve accurate functionality, reinforcing the importance of testing and incremental improvement.
Plan for next week:
Improve UI consistency and fix existing bugs.

18–19 March 2026
Redesigned booking and login pages for improved visual consistency. Fixed issues with service and price synchronisation.
Reflection:
Spending time on UI refinement improved overall user experience. This demonstrated that usability is as important as functionality.
Plan for next week:
Enhance tracking features and validation.

27–29 March 2026
Improved tracking page, enhanced form validation and added features such as “Find Order” and a comment system.
Reflection:
Adding interactivity improved user engagement. Validation improvements reduced errors and increased system robustness.
Plan for next week:
Integrate mapping and external services.

April 2026 – Integration & Final Features
1 April 2026
Integrated map functionality into booking system. Improved image upload using Firebase Storage.
Reflection:
Integrating third-party services introduced complexity but significantly enhanced usability.
Plan for next week:
Implement notifications.

2 April 2026
Implemented email notifications using EmailJS to confirm bookings.
Reflection:
This fulfilled a key requirement and improved communication with users. It also highlighted the importance of integrating external APIs effectively.
Plan for next week:
Enhance admin tools.

7 April 2026
Developed “Today’s Schedule” view in admin dashboard and added booking map visualisation. Updated project milestones.
Reflection:
This feature improved operational efficiency for administrators. Updating milestones helped realign development priorities.
Plan for next week:
Add final UI enhancements and accessibility improvements.

10 April 2026
Developed a settings page with light/dark mode customisation.
Reflection:
This feature enhanced accessibility and personalisation. It also demonstrated attention to user experience beyond core functionality.
Plan for next phase:
Conduct user testing, analyse results and improve.