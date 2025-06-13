# Task Management Application

-----

## Overview

This is a modern, full-stack **Task Management Application** meticulously engineered to provide a comprehensive solution for personal and professional productivity. It features a responsive **Angular** frontend seamlessly integrated with a high-performance **FastAPI** backend. This application is designed to streamline task organization, enhance user productivity, and offer insightful analytics.

Key highlights include:

  * **Secure user authentication** and personalized profiles.
  * Advanced **task management** capabilities with prioritization and status tracking.
  * **Real-time productivity analytics** and insights.
  * Intuitive **user experience** with responsive design and modern UI features.
  * Robust **email communication** and notification system.

-----

## ✨ Key Features

### 🔐 Authentication & User Management

  * **Secure User Registration and Login**: Robust authentication mechanisms for user accounts.
  * **JWT Token-Based Authentication**: Industry-standard secure token management for API access.
  * **Password Change and Account Management**: Comprehensive user control over their account settings.
  * **User-Specific Profile Pictures and Data**: Personalized user experience with customizable profiles.

### 📊 Task Management

  * **Create, Edit, and Delete Tasks**: Full CRUD (Create, Read, Update, Delete) operations for seamless task control.
  * **Task Prioritization**: Assign clear priorities (High, Medium, Low) to effectively manage workload.
  * **Status Tracking**: Monitor task progress with distinct statuses: "Not Started," "In Progress," and "Completed."
  * **Due Date Management with Overdue Notifications**: Receive timely alerts for approaching or missed deadlines.
  * **Tag System for Better Organization**: Categorize tasks efficiently using custom tags for quick filtering.
  * **Time Tracking and Estimation**: Log time spent on tasks and estimate future efforts for improved planning.
  * **Bulk Operations and Drag-and-Drop Interface**: Efficiently manage multiple tasks and reorder them with an intuitive drag-and-drop feature.

### 📈 Analytics & Insights

  * **Personal Productivity Dashboard**: A centralized, visual overview of individual productivity metrics.
  * **Task Completion Statistics**: Track your success rate and gain insights into completed tasks over time.
  * **Time Efficiency Tracking**: Analyze how effectively time is utilized across various tasks.
  * **Productivity Trends and Patterns**: Identify long-term work habits, peak performance times, and areas for improvement.
  * **Overdue Task Monitoring**: Keep a close watch on tasks that have passed their due date to ensure nothing falls through the cracks.

### 🎨 User Experience

  * **Responsive Design for All Devices**: Ensures a seamless and optimized experience across desktops, tablets, and mobile phones.
  * **Dark/Light Mode Support**: Customizable interface themes to suit user preference and reduce eye strain.
  * **Real-time Greeting Based on Time of Day**: A dynamic and welcoming personalized touch.
  * **Smooth Animations and Transitions**: Enhanced visual appeal and fluid user interactions.
  * **Intuitive User Interface**: Designed for ease of navigation and a straightforward user journey.

### 📧 Communication

  * **Contact Form with Email Notifications**: Enables users to reach out directly with automated email alerts to the administrator.
  * **Admin Message Management**: Tools for administrators to efficiently handle and respond to user communications.
  * **SMTP Integration for Notifications**: Reliable email delivery system for various application alerts and updates.

-----

## 🖼️ Application Screenshots

Below are screenshots demonstrating the core user experience and features.  
*Images are located in `frontend/src/assets/site images/`.*

<table>
  <tr>
    <td align="center"><b>Landing Page</b></td>
    <td align="center"><b>Login</b></td>
    <td align="center"><b>Register</b></td>
  </tr>
  <tr>
    <td><img src="frontend/src/assets/site%20images/LANDING%20PAGE.png" alt="Landing Page" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/login.png" alt="Login" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/register.png" alt="Register" width="220"/></td>
  </tr>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>Add Task</b></td>
    <td align="center"><b>Analytics</b></td>
  </tr>
  <tr>
    <td><img src="frontend/src/assets/site%20images/dashboard.png" alt="Dashboard" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/add%20task.png" alt="Add Task" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/analytics.png" alt="Analytics" width="220"/></td>
  </tr>
  <tr>
    <td align="center"><b>Calendar View</b></td>
    <td align="center"><b>Profile</b></td>
    <td align="center"><b>Account Settings</b></td>
  </tr>
  <tr>
    <td><img src="frontend/src/assets/site%20images/calender%20view.png" alt="Calendar View" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/profile.png" alt="Profile" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/account%20settings.png" alt="Account Settings" width="220"/></td>
  </tr>
  <tr>
    <td align="center"><b>Cookies Policy</b></td>
    <td align="center"><b>Privacy Policy</b></td>
    <td align="center"><b>Terms of Service</b></td>
  </tr>
  <tr>
    <td><img src="frontend/src/assets/site%20images/cookies.png" alt="Cookies Policy" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/privacy.png" alt="Privacy Policy" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/terms.png" alt="Terms of Service" width="220"/></td>
  </tr>
  <tr>
    <td align="center"><b>Secondary Terms Page</b></td>
    <td align="center"><b>Footer</b></td>
    <td></td>
  </tr>
  <tr>
    <td><img src="frontend/src/assets/site%20images/terms2.png" alt="Secondary Terms" width="220"/></td>
    <td><img src="frontend/src/assets/site%20images/FOOTER.png" alt="Footer" width="220"/></td>
    <td></td>
  </tr>
</table>

### Image Descriptions
- **Landing Page:** Modern introductory splash page for the app.
- **Login:** Secure login form for existing users.
- **Register:** New user registration screen.
- **Dashboard:** Central hub for viewing and organizing all tasks.
- **Add Task:** Modal/dialog for creating a new task with all necessary details.
- **Analytics:** Visual productivity analytics and completion stats.
- **Calendar View:** View and manage tasks by due date in a calendar format.
- **Profile:** User profile details and personal info.
- **Account Settings:** Manage password, email, and authentication settings.
- **Cookies Policy:** Info on cookies and user privacy.
- **Privacy Policy:** Full privacy practices and data handling.
- **Terms of Service:** App usage terms and conditions.
- **Secondary Terms Page:** Additional legal or informational terms.
- **Footer:** App footer with navigation and additional information.

*For the full and most up-to-date set of images, [browse the assets directory](https://github.com/PixieStack/task-management/tree/master/frontend/src/assets/site%20images) on GitHub.*

-----

## 🛠️ Tech Stack

### Frontend

  * **Angular 17+**: A cutting-edge, component-based framework for building dynamic single-page applications.
  * **TypeScript**: A strongly-typed superset of JavaScript that enhances code quality and developer productivity.
  * **SCSS**: Syntactically Awesome Style Sheets for powerful, modular, and maintainable CSS.
  * **Angular Animations**: For rich and smooth UI transitions and sophisticated visual effects.
  * **Reactive Forms**: A robust, model-driven approach to form validation and management in Angular applications.
  * **HttpClient**: Angular's built-in module for making efficient HTTP requests to communicate with the backend API.

### Backend

  * **FastAPI**: A modern, high-performance web framework for building APIs with Python 3.7+, leveraging standard Python type hints for data validation and auto-generated OpenAPI documentation.
  * **SQLAlchemy**: A powerful SQL toolkit and Object Relational Mapper (ORM) for Python, providing a flexible interface for database interactions.
  * **SQLite**: A lightweight, file-based relational database management system, ideal for development, testing, and small-scale deployments.
  * **JWT (JSON Web Token)**: Used for secure and stateless authentication, enabling secure information exchange between the frontend and backend.
  * **Pydantic**: A data validation and settings management library using Python type hints, ensuring data integrity for API requests and responses.
  * **SMTP**: Utilized for sending emails directly from the backend, supporting features like user notifications and contact form submissions.

### Development Tools

  * **Git**: An indispensable version control system for tracking changes and collaborative development.
  * **VS Code (Visual Studio Code)**: A highly customizable and popular code editor offering extensive features for development.
  * **Postman**: A widely used API platform for building, testing, and documenting APIs.

-----

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following software installed on your system:

  * **Node.js** (v18 or higher): Essential for running the Angular frontend development environment.
  * **Python** (v3.8 or higher): Required for setting up and running the FastAPI backend.
  * **Git**: For cloning the application repository and managing source code versions.

### Installation and Running the Application

Follow these steps to set up and launch the Task Management Application:

1.  **Clone the repository:**
    Begin by cloning the project from its GitHub repository:

    ```bash
    git clone git@github.com:PixieStack/task-management.git
    cd task-management
    ```

    *Note: This project's code is hosted under the **PixieStack** GitHub account.*

2.  **Set up and run the Backend (FastAPI):**
    Navigate to the `backend` directory, install the necessary Python dependencies, and then start the FastAPI server.

    ```bash
    cd backend
    # It's recommended to use a Python virtual environment:
    # python -m venv venv
    # For Windows: .\venv\Scripts\activate
    # For macOS/Linux: source venv/bin/activate

    # Install Python dependencies (ensure you have a requirements.txt if needed)
    # pip install -r requirements.txt 

    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

    *The backend will typically be accessible at `http://localhost:8000`.*

      * **Crucially, the backend must be running for the application's authentication and data features to work.**

3.  **Set up and run the Frontend (Angular):**
    Open a **new terminal window**. Navigate into the `frontend` directory, install its Node.js dependencies, and then launch the Angular development server.

    ```bash
    cd frontend
    npm install
    ng serve --open
    ```

    *The frontend application will compile and automatically open in your default web browser, usually at `http://localhost:4200`.*

-----

## Troubleshooting

If you encounter any issues while setting up or running the application, consider these common troubleshooting steps:

  * **Verify Process Status**: Confirm that both the FastAPI backend and the Angular frontend servers are actively running in their respective terminal windows.
  * **Check Port Availability**: Ensure that ports `8000` (for FastAPI) and `4200` (for Angular) are not in use by other applications on your system. If they are, you might need to adjust the port numbers in the run commands.
  * **Review Backend Path**: If you see "Error loading ASGI app" messages, double-check that the `uvicorn` command correctly points to your FastAPI application (e.g., `app.main:app`).
  * **Inspect JWT Handling**: Issues like "JWT decoding failed" often indicate a mismatch in the `SECRET_KEY` between your backend's configuration and what's used to sign tokens, or an issue with how the frontend sends the token (e.g., missing `Authorization: Bearer <token>` header).
  * **Consult Console Logs**: Always examine the detailed error messages in both your backend and frontend terminal outputs; they are your primary source for diagnosing problems.
  * **Sass Deprecation Warnings**: While not critical errors, the Sass warnings about `lighten()` and `darken()` indicate outdated syntax. For future compatibility, consider updating your SCSS code to use `color.adjust()` or `color.scale()` as suggested by the warnings.

-----

## ⚖️ Legal Notice

This project, the **Task Management Application**, is part of my personal portfolio, developed solely by **Thembinkosi Eden Thwala** through **PixieStack**. While the code is publicly visible for demonstration purposes, it is **NOT open source**. All rights are expressly reserved. Unauthorized copying, modification, reproduction, redistribution, or any form of distribution of this code, in whole or in part, is **strictly prohibited** and may result in severe legal action.

© 2025 PixieStack. All Rights Reserved.

-----

## Contact

For support or inquiries regarding the **Task Management Application**, please contact:

**Thembinkosi Eden Thwala**

Email: thwalathembinkosi16@gmail.com