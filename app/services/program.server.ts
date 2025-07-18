import { createClient } from '~/utils/supabase.server';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
} from '~/types/multi-class';

/**
 * Create a new program
 */
export async function createProgram(
  programData: CreateProgramData,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program> {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      name: programData.name,
      description: programData.description,
      duration_minutes: programData.duration_minutes,
      // Capacity constraints
      max_capacity: programData.max_capacity,
      // Frequency constraints
      sessions_per_week: programData.sessions_per_week,
      min_sessions_per_week: programData.min_sessions_per_week,
      max_sessions_per_week: programData.max_sessions_per_week,
      // Belt requirements
      min_belt_rank: programData.min_belt_rank,
      max_belt_rank: programData.max_belt_rank,
      belt_rank_required: programData.belt_rank_required ?? false,
      // Prerequisite programs
      prerequisite_programs: programData.prerequisite_programs,
      // Age and demographic constraints
      min_age: programData.min_age,
      max_age: programData.max_age,
      gender_restriction: programData.gender_restriction,
      special_needs_support: programData.special_needs_support,
      // Pricing structure
      monthly_fee: programData.monthly_fee,
      registration_fee: programData.registration_fee,
      yearly_fee: programData.yearly_fee,
      individual_session_fee: programData.individual_session_fee,
      // System fields
      is_active: programData.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create program: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing program
 */
export async function updateProgram(
  id: string,
  updates: Partial<UpdateProgramData>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
  // Capacity constraints
  if (updates.max_capacity !== undefined) updateData.max_capacity = updates.max_capacity;
  // Frequency constraints
  if (updates.sessions_per_week !== undefined) updateData.sessions_per_week = updates.sessions_per_week;
  if (updates.min_sessions_per_week !== undefined) updateData.min_sessions_per_week = updates.min_sessions_per_week;
  if (updates.max_sessions_per_week !== undefined) updateData.max_sessions_per_week = updates.max_sessions_per_week;
  // Belt requirements
  if (updates.min_belt_rank !== undefined) updateData.min_belt_rank = updates.min_belt_rank;
  if (updates.max_belt_rank !== undefined) updateData.max_belt_rank = updates.max_belt_rank;
  if (updates.belt_rank_required !== undefined) updateData.belt_rank_required = updates.belt_rank_required;
  // Prerequisite programs
  if (updates.prerequisite_programs !== undefined) updateData.prerequisite_programs = updates.prerequisite_programs;
  // Age and demographic constraints
  if (updates.min_age !== undefined) updateData.min_age = updates.min_age;
  if (updates.max_age !== undefined) updateData.max_age = updates.max_age;
  if (updates.gender_restriction !== undefined) updateData.gender_restriction = updates.gender_restriction;
  if (updates.special_needs_support !== undefined) updateData.special_needs_support = updates.special_needs_support;
  // Pricing structure
  if (updates.monthly_fee !== undefined) updateData.monthly_fee = updates.monthly_fee;
  if (updates.registration_fee !== undefined) updateData.registration_fee = updates.registration_fee;
  if (updates.yearly_fee !== undefined) updateData.yearly_fee = updates.yearly_fee;
  if (updates.individual_session_fee !== undefined) updateData.individual_session_fee = updates.individual_session_fee;
  // System fields
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('programs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update program: ${error.message}`);
  }

  return data;
}



/**
 * Get all programs with optional filtering
 */
export async function getPrograms(
  filters: { is_active?: boolean; search?: string } = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  let query = supabase.from('programs').select('*');

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch programs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single program by ID
 */
export async function getProgramById(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch program: ${error.message}`);
  }

  return data;
}

/**
 * Get programs with basic statistics (class count, enrollments)
 */
export async function getProgramsWithStats(
  filters: { is_active?: boolean; search?: string } = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  let query = supabase
    .from('programs')
    .select(`
      *,
      classes!inner(
        id,
        is_active,
        max_capacity,
        enrollments!inner(
          id,
          status,
          payment_id,
          payments(
            amount,
            status
          )
        )
      )
    `);

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch programs with stats: ${error.message}`);
  }

  // These interfaces are defined but may be used in the future for more complex operations



  // Simplified - just return the programs without complex statistics
  return data || [];
}

/**
 * Get overall program statistics
 */
export async function getProgramStats(
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ total_programs: number; active_programs: number; total_classes: number; active_classes: number }> {
  // Get basic counts
  const [programsResult, classesResult, enrollmentsResult] = await Promise.all([
    supabase.from('programs').select('id, is_active'),
    supabase.from('classes').select('id, is_active'),
    supabase.from('enrollments').select('id, status'),
  ]);

  if (programsResult.error) {
    throw new Error(`Failed to fetch program stats: ${programsResult.error.message}`);
  }
  if (classesResult.error) {
    throw new Error(`Failed to fetch class stats: ${classesResult.error.message}`);
  }
  if (enrollmentsResult.error) {
    throw new Error(`Failed to fetch enrollment stats: ${enrollmentsResult.error.message}`);
  }

  const programs = programsResult.data || [];
  const classes = classesResult.data || [];

  return {
    total_programs: programs.length,
    active_programs: programs.filter((p: { is_active: boolean }) => p.is_active).length,
    total_classes: classes.length,
    active_classes: classes.filter((c: { is_active: boolean }) => c.is_active).length,
  };
}

/**
 * Check if a student can enroll in a program using database function
 */
export async function checkProgramEligibility(
  programId: string,
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ eligible: boolean; reasons: string[] }> {
  try {
    // Use the database function for comprehensive eligibility checking
    // Note: The function returns a simple boolean, not an object
    const { data, error } = await supabase
      .rpc('check_program_eligibility', {
        student_id_param: studentId,
        program_id_param: programId
      });

    if (error) {
      console.error('Error checking program eligibility:', error);
      return { eligible: false, reasons: ['Error checking eligibility'] };
    }

    console.log('check_program_eligibility result:', programId, studentId, data);

    // The database function returns a simple boolean
    const isEligible = Boolean(data);
    
    if (isEligible) {
      return { eligible: true, reasons: [] };
    } else {
      // Since the DB function doesn't provide specific reasons, we return a generic message
      return { eligible: false, reasons: ['Student does not meet program requirements'] };
    }
  } catch (error) {
    console.error('Exception in checkProgramEligibility:', error);
    return { eligible: false, reasons: ['System error checking eligibility'] };
  }
}

/**
 * Get programs suitable for a specific student based on eligibility
 */
export async function getProgramsForStudent(
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  // Get all active programs
  const allPrograms = await getPrograms({ is_active: true }, supabase);
  
  // Filter programs based on student eligibility
  const eligiblePrograms: Program[] = [];
  
  for (const program of allPrograms) {
    const eligibilityCheck = await checkProgramEligibility(
      program.id,
      studentId,
      supabase
    );
    
    if (eligibilityCheck.eligible) {
      eligiblePrograms.push(program);
    }
  }
  
  return eligiblePrograms;
}