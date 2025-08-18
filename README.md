# Threads Intel

A modern intelligence data management system that ingests data from WordPress REST APIs and provides a responsive, searchable interface with role-based access control.

## Features

- **Data Ingestion**: Automated sync from WordPress REST API
- **Advanced Search**: Full-text search with category filtering
- **Role-Based Access**: Admin, Edit, and View roles with granular permissions
- **Data Retention**: Automatic data purging based on retention policies
- **Audit Logging**: Complete audit trail of user actions
- **Responsive UI**: Modern Material-UI interface optimized for all devices

## Technology Stack

### Backend
- Node.js with Express
- PostgreSQL with full-text search
- JWT authentication
- Automated cron jobs for data sync/purge

### Frontend
- React with TypeScript
- Material-UI components
- React Router for navigation
- Axios for API communication

## Setup Instructions

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd threads-intel
npm run install:all
```

### 2. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE threads_intel;
CREATE USER threads_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE threads_intel TO threads_user;
```

### 3. Environment Configuration

Copy the environment template:
```bash
cp .env.example .env
```

Configure the following variables in `.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=threads_intel
DB_USER=threads_user
DB_PASSWORD=your_password

# WordPress API
WORDPRESS_API_URL=https://cmansrms.us/wp-json/wp/v2

# Security
JWT_SECRET=your_jwt_secret_key_here

# Server
PORT=5000
NODE_ENV=development

# Data Retention
DEFAULT_RETENTION_DAYS=365
```

### 4. Create Admin User

Run the setup script to create an initial admin user:
```bash
node scripts/create-admin.js
```

### 5. Start the Application

Development mode (runs both backend and frontend):
```bash
npm run dev
```

Or start components separately:
```bash
# Backend only
npm run server:dev

# Frontend only (in separate terminal)
npm run client:dev
```

### 6. Initial Data Sync

1. Log in with your admin account
2. Navigate to Admin Dashboard
3. Click "Sync WordPress Data" to perform initial ingestion

## User Roles

### Admin
- Full system access
- User management
- Data ingestion controls
- System maintenance
- Audit log access

### Edit
- Create/edit/delete posts
- Manage categories
- View all content

### View
- Read-only access to posts
- Search and filter capabilities
- Export functionality

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/register` - Create new user (admin only)

### Posts
- `GET /api/posts` - List posts with search/filter
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create new post (edit/admin)
- `PUT /api/posts/:id` - Update post (edit/admin)
- `DELETE /api/posts/:id` - Delete post (admin)

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category (edit/admin)
- `PUT /api/categories/:id` - Update category (edit/admin)

### Admin
- `GET /api/admin/dashboard` - Dashboard statistics
- `POST /api/admin/ingest-wordpress` - Trigger data sync
- `POST /api/admin/purge-expired` - Purge expired data
- `GET /api/admin/audit-log` - View audit log

## Search Capabilities

The system provides powerful search functionality:

- **Full-text search** across titles and content
- **Category filtering** 
- **Author filtering**
- **Date range filtering**
- **Sort options** (date, title, author)
- **Pagination** for large result sets

## Data Retention

- Configurable retention periods per post
- Automatic purging via scheduled jobs
- Manual purge controls for administrators
- Retention date tracking and warnings

## Security Features

- JWT-based authentication
- Role-based authorization
- Rate limiting
- SQL injection prevention
- XSS protection via Material-UI
- Audit logging of all actions

## Scheduled Tasks

- **Daily**: WordPress data synchronization (2 AM)
- **Weekly**: Expired data purging (Sunday 3 AM)

## Development

### Adding New Features

1. Backend: Add routes in `/server/routes/`
2. Frontend: Add components in `/client/src/components/`
3. Update types in `/client/src/types/index.ts`
4. Add API methods in `/client/src/services/api.ts`

### Database Migrations

The system automatically initializes the database schema on startup. For schema changes, update `/server/config/database.js`.

## Production Deployment

1. Set `NODE_ENV=production`
2. Build frontend: `npm run build`
3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Configure production database
6. Set up monitoring and logging

## Troubleshooting

### Common Issues

**Database connection errors**: Check PostgreSQL is running and credentials are correct.

**WordPress API errors**: Verify the API URL is accessible and returns valid JSON.

**Authentication issues**: Check JWT secret is configured and consistent.

**Search not working**: Ensure PostgreSQL extensions are installed and search vectors are updated.

## License

This project is licensed under the ISC License.