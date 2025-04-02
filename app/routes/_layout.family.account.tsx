import {ActionFunctionArgs, json, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node"; // Added redirect
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react"; // Added useActionData, useNavigation
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Database} from "~/types/supabase"; // Import Database type
import {z} from "zod"; // For validation
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form"; // Shadcn Form components
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select"; // Import Select
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For feedback
import {ClientOnly} from "~/components/client-only";
import {useEffect} from "react";
import {Checkbox} from "~/components/ui/checkbox"; // Import Checkbox for preferences

// Define a type for serialized Zod issues (plain objects)
type SerializedZodIssue = {
    path: (string | number)[]; // Path can include numbers for array indices
    message: string;
};

// Define Supabase types for easier access
type FamilyRow = Database['public']['Tables']['families']['Row'];
type GuardianRow = Database['public']['Tables']['guardians']['Row'];

// Define expected loader data structure
interface LoaderData {
    family?: FamilyRow;
    guardians?: GuardianRow[];
    waiverSignatures?: Database['public']['Tables']['waiver_signatures']['Row'][];
    userPreferences?: {
        receiveMarketingEmails: boolean;
    };
    error?: string;
}

// --- Validation Schemas ---
const preferencesSchema = z.object({
    intent: z.literal('updatePreferences'),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
    receiveMarketingEmails: z.coerce.boolean().optional()
}).superRefine((data, ctx) => {
    // Current password required if changing password
    if ((data.newPassword || data.confirmPassword) && !data.currentPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['currentPassword'],
            message: "Current password is required to change password"
        });
    }

    // Password confirmation match
    if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['confirmPassword'],
            message: "Passwords must match"
        });
    }

    // New password requirements
    if (data.newPassword && data.newPassword.length < 8) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['newPassword'],
            message: "Password must be at least 8 characters"
        });
    }

    // Password complexity check
    if (data.newPassword && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(data.newPassword)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['newPassword'],
            message: "Password must contain uppercase, lowercase, and number"
        });
    }
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const familySchema = z.object({
    intent: z.literal('updateFamily'),
    name: z.string().min(1, "Family name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"),
    postal_code: z.string().min(1, "Postal code is required"),
    primary_phone: z.string().min(1, "Primary phone is required"),
    email: z.string().email("Invalid email address"),
    // Optional fields don't need min(1)
    referral_source: z.string().optional().nullable(),
    referral_name: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    health_info: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});
type FamilyFormData = z.infer<typeof familySchema>;

const guardianSchema = z.object({
    intent: z.literal('updateGuardian'),
    guardianId: z.string().uuid("Invalid Guardian ID"),
    first_name: z.string().trim().min(1, "First name is required"), // Added trim
    last_name: z.string().trim().min(1, "Last name is required"), // Added trim
    relationship: z.string().trim().min(1, "Relationship is required"), // Added trim
    home_phone: z.string().trim().min(1, "Home phone is required"), // Added trim
    cell_phone: z.string().trim().min(1, "Cell phone is required"), // Added trim
    email: z.string().email("Invalid email address"),
    // Optional fields
    work_phone: z.string().optional().nullable(),
    employer: z.string().optional().nullable(),
    employer_phone: z.string().optional().nullable(),
    employer_notes: z.string().optional().nullable(),
});
type GuardianFormData = z.infer<typeof guardianSchema>;

// Combined schema for parsing intent in action
const formSchema = z.union([
    familySchema,
    guardianSchema,
    preferencesSchema
]);

// --- Loader ---
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Redirect or error if not logged in (should be handled by layout)
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // Fetch profile to get family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for account page:", profileError?.message);
        return json({error: "Failed to load user profile or family association."}, {status: 500, headers});
    }

    const familyId = profileData.family_id;

    // Fetch family data using family_id
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('*') // Fetch all family fields
        .eq('id', familyId)
        .single();

    // Fetch associated guardians
    const {data: guardiansData, error: guardiansError} = await supabaseServer
        .from('guardians')
        .select('*')
        .eq('family_id', familyId);

    // Fetch waiver signatures
    const {data: waiverSignaturesData} = await supabaseServer
        .from('waiver_signatures')
        .select('*, waivers(title, description)')
        .eq('user_id', user.id)
        .order('signed_at', {ascending: false});

    // Get user preferences from auth metadata
    const userPreferences = {
        receiveMarketingEmails: user.user_metadata?.receive_marketing_emails ?? true
    };

    if (familyError || !familyData) {
        console.error("Error fetching family data for account page:", familyError?.message);
        // Return null for family but still try to return guardians if fetched
        return json({guardians: guardiansData ?? [], error: "Failed to load family details."}, {status: 500, headers});
    }

    if (guardiansError) {
        console.error("Error fetching guardians data for account page:", guardiansError?.message);
        // Return family data but indicate error fetching guardians
        return json({family: familyData, guardians: [], error: "Failed to load guardian details."}, {
            status: 500,
            headers
        });
    }

    return json({
        family: familyData,
        guardians: guardiansData ?? [],
        waiverSignatures: waiverSignaturesData || [],
        userPreferences
    }, {headers});
}

// --- Action ---
type ActionResponse = {
    status: 'success' | 'error';
    message: string;
    errors?: SerializedZodIssue[]; // Use the serialized type
    intent?: 'updateFamily' | 'updateGuardian' | 'updatePreferences';
    guardianId?: string; // To identify which guardian form had an error
};

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const formData = await request.formData();
    const formValues = Object.fromEntries(formData.entries());

    const parsed = formSchema.safeParse(formValues);

    if (!parsed.success) {
        console.error("Form validation failed:", parsed.error.issues);
        return json({
            status: 'error',
            message: 'Invalid form data.',
            errors: parsed.error.issues,
            // Provide a more specific type than 'any'
            intent: formData.get('intent') as 'updateFamily' | 'updateGuardian' | undefined,
            guardianId: formData.get('guardianId') as string | undefined, // Pass guardianId back if present
        }, {status: 400, headers});
    }

    const {intent} = parsed.data;

    try {
        if (intent === 'updateFamily') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {intent: _, ...familyUpdateData} = parsed.data; // Exclude intent

            // Need family ID - fetch it again based on user (safer than hidden field)
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (!user) return json({status: 'error', message: 'User not authenticated.'}, {status: 401, headers});

            const {data: profileData, error: profileError} = await supabaseServer
                .from('profiles').select('family_id').eq('id', user.id).single();
            if (profileError || !profileData?.family_id) {
                return json({status: 'error', message: 'Could not find associated family.'}, {status: 404, headers});
            }

            const {error: updateError} = await supabaseServer
                .from('families')
                .update(familyUpdateData)
                .eq('id', profileData.family_id);

            if (updateError) throw updateError;

            return json({status: 'success', message: 'Family information updated successfully.', intent}, {headers});

        } else if (intent === 'updateGuardian') {
            const {guardianId, ...restData} = parsed.data; // Exclude guardianId
            const {intent, ...guardianUpdateData} = restData; // Exclude intent

            // Verify guardianId belongs to the user's family before updating (security)
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (!user) return json({status: 'error', message: 'User not authenticated.'}, {status: 401, headers});
            const {data: profileData, error: profileError} = await supabaseServer
                .from('profiles').select('family_id').eq('id', user.id).single();
            if (profileError || !profileData?.family_id) {
                return json({status: 'error', message: 'Could not find associated family.'}, {status: 404, headers});
            }

            const {data: guardianCheck, error: checkError} = await supabaseServer
                .from('guardians')
                .select('id')
                .eq('id', guardianId)
                .eq('family_id', profileData.family_id)
                .maybeSingle(); // Use maybeSingle to handle null case

            if (checkError || !guardianCheck) {
                console.error("Guardian verification failed:", checkError?.message);
                return json({
                    status: 'error',
                    message: 'Guardian not found or access denied.',
                    intent,
                    guardianId
                }, {status: 404, headers});
            }
            // --- End verification ---

            const {error: updateError} = await supabaseServer
                .from('guardians')
                .update(guardianUpdateData)
                .eq('id', guardianId);

            if (updateError) throw updateError;

            return json({
                status: 'success',
                message: 'Guardian information updated successfully.',
                intent,
                guardianId
            }, {headers});
        } else if (intent === 'updatePreferences') {
            const {currentPassword, newPassword, receiveMarketingEmails} = parsed.data;

            // Get user
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (!user) return json({status: 'error', message: 'Not authenticated'}, {status: 401, headers});

            // Update password if provided
            if (newPassword && currentPassword) {
                const {error: updateError} = await supabaseServer.auth.updateUser({
                    password: newPassword,
                    data: {receive_marketing_emails: receiveMarketingEmails}
                });

                if (updateError) throw updateError;
            }

            // Update email preferences if no password change
            if (!newPassword) {
                const {error} = await supabaseServer.auth.updateUser({
                    data: {receive_marketing_emails: receiveMarketingEmails}
                });
                if (error) throw error;
            }

            return json({
                status: 'success',
                message: 'Preferences updated successfully',
                intent: 'updatePreferences'
            }, {headers});
        }

        // Should not happen if schema is correct
        return json({status: 'error', message: 'Invalid form intent.'}, {status: 400, headers});

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error(`Error during ${intent}:`, message);
        return json({
            status: 'error',
            message: `Failed to update information: ${message}`,
            intent: intent,
            guardianId: intent === 'updateGuardian' ? parsed.data.guardianId : undefined,
        }, {status: 500, headers});
    }
}


// --- Component ---

// Helper to get default values, handling nulls
const getDefaultValue = (value: string | null | undefined) => value ?? '';

export default function AccountSettingsPage() {
    const {family, guardians, userPreferences, error: loaderError} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // --- Preferences Form ---
    const preferencesForm = useForm<PreferencesFormData>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: {
            intent: 'updatePreferences',
            receiveMarketingEmails: userPreferences?.receiveMarketingEmails ?? true
        }
    });

    // Reset form when action completes
    useEffect(() => {
        if (actionData?.intent === 'updatePreferences' && actionData.status === 'success') {
            preferencesForm.reset();
        }
    }, [actionData, preferencesForm]);

    // --- Family Form ---
    const familyForm = useForm<FamilyFormData>({
        resolver: zodResolver(familySchema),
        // Initialize with empty/default values, not directly from loader data
        defaultValues: {
            intent: 'updateFamily',
            name: '',
            address: '',
            city: '',
            province: '',
            postal_code: '',
            primary_phone: '',
            email: '',
            referral_source: '',
            referral_name: '',
            emergency_contact: '',
            health_info: '',
            notes: '',
        },
    });

    // Reset form with loader data on client side
    useEffect(() => {
        if (!familyForm) return;
        if (family) {
            familyForm.reset({
                intent: 'updateFamily',
                name: getDefaultValue(family.name),
                address: getDefaultValue(family.address),
                city: getDefaultValue(family.city),
                province: getDefaultValue(family.province),
                postal_code: getDefaultValue(family.postal_code),
                primary_phone: getDefaultValue(family.primary_phone),
                email: getDefaultValue(family.email),
                referral_source: getDefaultValue(family.referral_source),
                referral_name: getDefaultValue(family.referral_name),
                emergency_contact: getDefaultValue(family.emergency_contact),
                health_info: getDefaultValue(family.health_info),
                notes: getDefaultValue(family.notes),
            });
        }
    }, [family, familyForm]); // Dependency array ensures this runs when family data is available

    // --- Guardian Forms (one for each guardian) ---
    // We need a way to manage multiple forms. We can create them dynamically.
    // This example assumes you might have multiple guardians and creates a form instance for each.
    // Note: Managing dynamic forms with react-hook-form can get complex.
    // For simplicity here, we'll render separate forms.

    if (loaderError) {
        return <div className="text-red-500 p-4">Error loading account settings: {loaderError}</div>;
    }
    if (!family) {
        return <div className="text-orange-500 p-4">Could not load family details. Please try again later or contact
            support.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Family
                Portal</Link>

            <ClientOnly fallback={<div className="text-center p-8">Loading account settings...</div>}>
                {() => (
                    <> {/* Use fragment to avoid adding extra div */}
                        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

                        {/* General Action Feedback */}
                        {actionData && actionData.status === 'success' && (
                            <Alert variant="default"
                                   className="bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
                                <AlertTitle className="text-green-800 dark:text-green-200">Success!</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-300">
                                    {actionData.message}
                                </AlertDescription>
                            </Alert>
                        )}
                        {actionData && actionData.status === 'error' && !actionData.errors && ( // Show general errors only if no field errors
                            <Alert variant="destructive">
                                <AlertTitle className="dark:text-red-200">Error</AlertTitle>
                                <AlertDescription className="dark:text-red-300">{actionData.message}</AlertDescription>
                            </Alert>
                        )}


                        {/* --- Family Information Form --- */}
                        <UIForm {...familyForm}>
                            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Family Information</h2>
                                <input type="hidden" name="intent" value="updateFamily"/>

                                {/* Display field-specific errors for family form */}
                                {actionData?.intent === 'updateFamily' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle className="text-green-800 dark:text-green-200">Validation
                                            Errors</AlertTitle>
                                        <AlertDescription className="text-green-700 dark:text-green-300">
                                            <ul className="list-disc pl-5">
                                                {/* Use the SerializedZodIssue type */}
                                                {actionData.errors.map((err: SerializedZodIssue, i: number) => <li
                                                    key={i}>{err.path.join('.')} : {err.message}</li>)}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={familyForm.control}
                                        name="name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Family Last Name</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="primary_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Primary Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="email"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Family Email</FormLabel>
                                                <FormControl><Input type="email" {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="address"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Home Address</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="city"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>City</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="province"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Province</FormLabel>
                                                {/* Wrap Select with ClientOnly */}
                                                <ClientOnly fallback={<Input disabled placeholder="Province..."/>}>
                                                    {() => (
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value} // Use field.value directly
                                                            // Remove defaultValue
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue
                                                                    placeholder="Select province"/></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {/* ... SelectItems ... */}
                                                                <SelectItem value="AB">Alberta</SelectItem>
                                                                <SelectItem value="BC">British Columbia</SelectItem>
                                                                <SelectItem value="MB">Manitoba</SelectItem>
                                                                <SelectItem value="NB">New Brunswick</SelectItem>
                                                                <SelectItem value="NL">Newfoundland and
                                                                    Labrador</SelectItem>
                                                                <SelectItem value="NS">Nova Scotia</SelectItem>
                                                                <SelectItem value="ON">Ontario</SelectItem>
                                                                <SelectItem value="PE">Prince Edward Island</SelectItem>
                                                                <SelectItem value="QC">Quebec</SelectItem>
                                                                <SelectItem value="SK">Saskatchewan</SelectItem>
                                                                <SelectItem value="NT">Northwest
                                                                    Territories</SelectItem>
                                                                <SelectItem value="NU">Nunavut</SelectItem>
                                                                <SelectItem value="YT">Yukon</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </ClientOnly>
                                                {/* Add hidden input to ensure value is submitted with form */}
                                                <input
                                                    type="hidden"
                                                    name="province"
                                                    value={field.value || ''}
                                                />
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="postal_code"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Postal Code</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    {/* Optional Fields */}
                                    <FormField
                                        control={familyForm.control}
                                        name="emergency_contact"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Emergency Contact (Not Guardian 1 or 2)</FormLabel>
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="health_info"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Personal Health Number / Info</FormLabel>
                                                {/* Removed duplicated FormItem and FormLabel */}
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="emergency_contact"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Emergency Contact (Not Guardian 1 or 2)</FormLabel>
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="notes"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Family Notes (Internal Use)</FormLabel>
                                                {/* Removed duplicated FormItem and FormLabel */}
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && navigation.formData?.get('intent') === 'updateFamily' ? 'Saving...' : 'Update Family Info'}
                                </Button>
                            </Form>
                        </UIForm>

                        {/* Policy Agreements section removed - will be handled in a separate route */}

                        {/* --- Guardian Information Forms --- */}
                        {(guardians ?? []).map((guardian, index) => (
                            <ClientOnly key={guardian.id} fallback={<div
                                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6 animate-pulse"><h2
                                className="text-xl font-semibold mb-4 border-b pb-2">Loading Guardian
                                #{index + 1}...</h2></div>}>
                                {() => (
                                    <GuardianForm guardian={guardian} index={index + 1}
                                                  actionData={actionData}
                                                  isSubmitting={isSubmitting} navigation={navigation}/>
                                )}
                            </ClientOnly>
                        ))}


                        {/* --- Account Preferences --- */}
                        <UIForm {...preferencesForm}>
                            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                                <h2 className="text-xl font-semibold mb-4">Account Preferences</h2>
                                <input type="hidden" name="intent" value="updatePreferences"/>

                                {actionData?.intent === 'updatePreferences' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle>Validation Errors</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-5">
                                                {actionData.errors.map((err, i) =>
                                                    <li key={i}>{err.path.join('.')} : {err.message}</li>
                                                )}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={preferencesForm.control}
                                        name="currentPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Current Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={preferencesForm.control}
                                        name="newPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>New Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormMessage className="text-sm text-muted-foreground mt-1">
                                        Password must be at least 8 characters and contain uppercase, lowercase, and
                                        number.
                                    </FormMessage>

                                    <FormField
                                        control={preferencesForm.control}
                                        name="confirmPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={preferencesForm.control}
                                        name="receiveMarketingEmails"
                                        render={({field}) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        Receive marketing emails
                                                    </FormLabel>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting && navigation.formData?.get('intent') === 'updatePreferences'
                                        ? 'Saving...'
                                        : 'Update Preferences'}
                                </Button>
                            </Form>
                        </UIForm>
                    </>
                )}
            </ClientOnly>
        </div>
    );
}


// --- Guardian Form Component ---
// Extracted for clarity and reusability if adding guardians later
interface GuardianFormProps {
    guardian: GuardianRow;
    index: number;
    actionData?: ActionResponse;
    isSubmitting: boolean;
    navigation: ReturnType<typeof useNavigation>;
}

function GuardianForm({guardian, index, actionData, isSubmitting, navigation}: GuardianFormProps) {
    const guardianForm = useForm<GuardianFormData>({
        resolver: zodResolver(guardianSchema),
        // Initialize defaultValues directly from the guardian prop
        defaultValues: {
            intent: 'updateGuardian',
            guardianId: guardian.id,
            first_name: getDefaultValue(guardian.first_name),
            last_name: getDefaultValue(guardian.last_name),
            relationship: getDefaultValue(guardian.relationship),
            home_phone: getDefaultValue(guardian.home_phone),
            cell_phone: getDefaultValue(guardian.cell_phone),
            email: getDefaultValue(guardian.email),
            work_phone: getDefaultValue(guardian.work_phone),
            employer: getDefaultValue(guardian.employer),
            employer_phone: getDefaultValue(guardian.employer_phone),
            employer_notes: getDefaultValue(guardian.employer_notes),
        },
    });

    // Reset form with guardian data on client side using useEffect
    useEffect(() => {
        // Ensure this only runs client-side after hydration
        if (typeof window !== 'undefined') {
            guardianForm.reset({
                intent: 'updateGuardian',
                guardianId: guardian.id,
                first_name: getDefaultValue(guardian.first_name),
                last_name: getDefaultValue(guardian.last_name),
                relationship: getDefaultValue(guardian.relationship),
                home_phone: getDefaultValue(guardian.home_phone),
                cell_phone: getDefaultValue(guardian.cell_phone),
                email: getDefaultValue(guardian.email),
                work_phone: getDefaultValue(guardian.work_phone),
                employer: getDefaultValue(guardian.employer),
                employer_phone: getDefaultValue(guardian.employer_phone),
                employer_notes: getDefaultValue(guardian.employer_notes),
            });
        }
    }, [guardian, guardianForm]); // Re-add dependencies

    return (
        // REMOVE ClientOnly wrapper from GuardianForm UI - rely on parent and specific component wrappers
        // Fallback logic might need adjustment if loading state is desired here
        <UIForm {...guardianForm}>
            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Guardian #{index} Information</h2>
                <input type="hidden" name="intent" value="updateGuardian"/>
                <input type="hidden" name="guardianId" value={guardian.id}/>

                {/* Display field-specific errors for this guardian form */}
                {actionData?.intent === 'updateGuardian' && actionData.guardianId === guardian.id && actionData.errors && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Validation Errors</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5">
                                {/* Use the SerializedZodIssue type */}
                                {actionData.errors.map((err: SerializedZodIssue, i: number) => <li
                                    key={i}>{err.path.join('.')} : {err.message}</li>)}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={guardianForm.control}
                        name="first_name"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={guardianForm.control}
                        name="last_name"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="relationship"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Relationship</FormLabel>
                                {/* Wrap Select with ClientOnly */}
                                <ClientOnly fallback={<Input disabled placeholder="Relationship..."/>}>
                                    {() => (
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value} // Use field.value directly
                                            // Remove defaultValue
                                        >
                                            <FormControl>
                                                <SelectTrigger><SelectValue
                                                    placeholder="Select relationship"/></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Mother">Mother</SelectItem>
                                                <SelectItem value="Father">Father</SelectItem>
                                                <SelectItem value="Guardian">Guardian</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </ClientOnly>
                                {/* Add hidden input to ensure value is submitted with form */}
                                <input
                                    type="hidden"
                                    name="relationship"
                                    value={field.value || ''}
                                />
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={guardianForm.control}
                        name="home_phone"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Home Phone</FormLabel>
                                <FormControl><Input type="tel" {...field} /></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="cell_phone"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Cell Phone</FormLabel>
                                <FormControl><Input type="tel" {...field} /></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="email"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input type="email" {...field} /></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="work_phone"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Work Phone</FormLabel>
                                <FormControl><Input type="tel" {...field}
                                                    value={getDefaultValue(field.value)}/></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="employer"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Employer</FormLabel>
                                <FormControl><Input {...field} value={getDefaultValue(field.value)}/></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="employer_phone"
                        render={({field}) => (
                            <FormItem>
                                <FormLabel>Employer Phone</FormLabel>
                                <FormControl><Input type="tel" {...field}
                                                    value={getDefaultValue(field.value)}/></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={guardianForm.control}
                        name="employer_notes"
                        render={({field}) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Employer Notes</FormLabel>
                                <FormControl><Textarea {...field} value={getDefaultValue(field.value)}/></FormControl>
                                <FormMessage className="dark:text-red-400"/>
                            </FormItem>
                        )}
                    />
                </div>

                {/* Remove name="intent" and value={formIntent} from button */}
                {/* Rely on the hidden input field above for the correct intent value */}
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && navigation.formData?.get('guardianId') === guardian.id ? 'Saving...' : `Update Guardian #${index}`}
                </Button>
            </Form>
        </UIForm>
    );
}
