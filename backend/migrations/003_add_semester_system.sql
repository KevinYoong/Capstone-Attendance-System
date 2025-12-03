-- Migration: Add Semester System (Phase 3)
-- Description: Adds Semester and Admin tables, modifies Class table for week tracking

-- ============================================
-- 1. Create Semester Table
-- ============================================
CREATE TABLE IF NOT EXISTS Semester (
  semester_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,                      -- e.g., "Fall 2024", "Spring 2025"
  start_date DATE NOT NULL,                       -- First day of Week 1
  end_date DATE NOT NULL,                         -- Last day of Week 14
  current_week INT DEFAULT 1,                     -- Current week (1-14)
  is_sem_break BOOLEAN DEFAULT FALSE,             -- TRUE during sem break (between Week 7 and 8)
  status ENUM('active', 'inactive') DEFAULT 'inactive',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_status (status)
);

-- ============================================
-- 2. Create Admin Table
-- ============================================
CREATE TABLE IF NOT EXISTS Admin (
  admin_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,                 -- bcrypt hashed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email)
);

-- ============================================
-- 3. Modify Class Table - Add Semester Tracking
-- ============================================
ALTER TABLE Class
  ADD COLUMN semester_id INT DEFAULT NULL,
  ADD COLUMN start_week INT DEFAULT 1,            -- Class starts in week X (1-14)
  ADD COLUMN end_week INT DEFAULT 14,             -- Class ends in week Y (1-14)
  ADD CONSTRAINT fk_class_semester
    FOREIGN KEY (semester_id)
    REFERENCES Semester(semester_id)
    ON DELETE SET NULL;                           -- If semester deleted, keep class but clear semester_id

-- ============================================
-- 4. Seed Sample Data
-- ============================================

-- Insert sample semester (Spring 2025)
INSERT INTO Semester (name, start_date, end_date, current_week, is_sem_break, status)
VALUES (
  'Spring 2025',
  '2025-01-06',      -- Week 1 starts (Monday, Jan 6, 2025)
  '2025-04-25',      -- Week 14 ends (Friday, Apr 25, 2025)
  1,                 -- Currently in Week 1
  FALSE,             -- Not in sem break
  'active'           -- Active semester
);

-- Insert sample admin user
-- Password: admin123 (bcrypt hashed)
-- Note: This hash will be generated via backend script after migration
INSERT INTO Admin (name, email, password)
VALUES (
  'System Administrator',
  'admin@university.edu',
  '$2b$10$K7Y5v5Zy5Z5Z5Z5Z5Z5Z5eFq5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5'  -- Placeholder - will update via backend
);

-- Update existing classes to belong to Spring 2025 semester
UPDATE Class
SET semester_id = 1,    -- Link to Spring 2025
    start_week = 1,     -- All classes run full semester
    end_week = 14
WHERE semester_id IS NULL;

-- ============================================
-- 5. Verification Queries (Optional - for manual testing)
-- ============================================
-- SELECT * FROM Semester;
-- SELECT * FROM Admin;
-- SELECT class_id, class_name, semester_id, start_week, end_week FROM Class;
