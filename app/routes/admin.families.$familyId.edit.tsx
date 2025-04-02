import invariant from "tiny-invariant";
import type {ActionFunctionArgs, LoaderFunctionArgs, MetaFunction} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useParams} from "@remix-run/react";
import {createClient} from "@supabase/supabase-js";
import {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Separator} from "~/components/ui/separator";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";

type FamilyRow = Database['public']['Tables']['families']['Row'];

// Define the shape of the data returned by the loader
type LoaderData = {
    family: FamilyRow;
};

// Define the shape of the data returned by the action
type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        name?: string;
        email?: string;
        primary_phone?: string;
        address?: string;
        city?: string;
        province?: string;
        postal_code?: string;
        emergency_contact?: string;
        health_info?: string;
        notes?: string;
        referral_source?: string;
        referral_name?: string;
    };
};

export const meta: MetaFunction<typeof loader> = ({data}) => {
    const familyName = data?.family?.name ?? "Edit Family";
    return [
        {title: `Edit ${familyName} | Admin Dashboard`},
        {name: "description", content: `Edit details for the ${familyName} family.`},
    ];
};

// Loader to fetch existing family data
export async function loader({params}: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Edit Loader] Missing Supabase URL or Service Role Key env vars.");
        throw new Response("Server configuration error", {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const {data: family, error} = await supabaseServer
        .from('families')
        .select('*')
        .eq('id', familyId)
        .single();

    if (error) {
        console.error(`[Edit Loader] Supabase error fetching family ${familyId}:`, error.message);
        throw new Response(`Database error: ${error.message}`, {status: 500});
    }

    if (!family) {
        throw new Response("Family not found", {status: 404});
    }

    return json({family});
}

// Action to handle form submission for updating family data
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;
    const formData = await request.formData();

    // Extract all fields from the form, matching the DB schema
    const name = formData.get("name") as string | null;
    const email = formData.get("email") as string | null;
    const primary_phone = formData.get("primary_phone") as string | null;
    const address = formData.get("address") as string | null;
    const city = formData.get("city") as string | null;
    const province = formData.get("province") as string | null;
    const postal_code = formData.get("postal_code") as string | null;
    const emergency_contact = formData.get("emergency_contact") as string | null;
    const health_info = formData.get("health_info") as string | null;
    const notes = formData.get("notes") as string | null;
    const referral_source = formData.get("referral_source") as string | null;
    const referral_name = formData.get("referral_name") as string | null;

    // Basic validation (consider using Zod for more complex validation)
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!name) fieldErrors.name = "Family name is required.";
    if (!email) fieldErrors.email = "Email is required.";
    if (!address) fieldErrors.address = "Address is required.";
    if (!city) fieldErrors.city = "City is required.";
    if (!province) fieldErrors.province = "Province is required.";
    if (!postal_code) fieldErrors.postal_code = "Postal code is required.";
    if (!primary_phone) fieldErrors.primary_phone = "Primary phone is required.";
    // Optional fields don't need presence validation unless specific formats are required

    if (Object.keys(fieldErrors).length > 0) {
        return json<ActionData>({error: "Validation failed", fieldErrors}, {status: 400});
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Edit Action] Missing Supabase URL or Service Role Key env vars.");
        return json<ActionData>({error: "Server configuration error"}, {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const {error} = await supabaseServer
        .from('families')
        .update({
            // Already validated non-null
            name: name!,
            email: email!,
            primary_phone: primary_phone!,
            address: address!,
            city: city!,
            province: province!,
            postal_code: postal_code!,
            // Optional fields
            emergency_contact: emergency_contact,
            health_info: health_info,
            notes: notes,
            referral_source: referral_source,
            referral_name: referral_name,
            updated_at: new Date().toISOString(), // Explicitly track updates
        })
        .eq('id', familyId);

    if (error) {
        console.error(`[Edit Action] Supabase error updating family ${familyId}:`, error.message);
        return json<ActionData>({error: `Database error: ${error.message}`}, {status: 500});
    }

    // Redirect back to the family detail page after successful update
    return redirect(`/admin/families/${familyId}`);
}


// Component for the Edit Family page
export default function EditFamilyPage() {
    const {family} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Edit Family: {family.name}</h1>
                {/* Top Cancel button removed */}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Edit Family Details</CardTitle>
                    <CardDescription>Update the information for the {family.name} family.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form method="post" className="space-y-4">
                        {actionData?.error && !actionData.fieldErrors && (
                            <Alert variant="destructive">
                                <ExclamationTriangleIcon className="h-4 w-4"/>
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{actionData.error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Family Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Family Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={family.name}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.name}
                                    aria-describedby="name-error"
                                />
                                {actionData?.fieldErrors?.name && (
                                    <p id="name-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.name}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={family.email}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.email}
                                    aria-describedby="email-error"
                                />
                                {actionData?.fieldErrors?.email && (
                                    <p id="email-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            {/* Primary Phone */}
                            <div className="space-y-2">
                                <Label htmlFor="primary_phone">Primary Phone</Label>
                                <Input
                                    id="primary_phone"
                                    name="primary_phone"
                                    type="tel"
                                    defaultValue={family.primary_phone ?? ''}
                                    aria-invalid={!!actionData?.fieldErrors?.primary_phone}
                                    aria-describedby="primary_phone-error"
                                />
                                {actionData?.fieldErrors?.primary_phone && (
                                    <p id="primary_phone-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.primary_phone}
                                    </p>
                                )}
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    defaultValue={family.address ?? ''}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.address}
                                    aria-describedby="address-error"
                                />
                                {actionData?.fieldErrors?.address && (
                                    <p id="address-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.address}
                                    </p>
                                )}
                            </div>

                            {/* City */}
                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    name="city"
                                    defaultValue={family.city ?? ''}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.city}
                                    aria-describedby="city-error"
                                />
                                {actionData?.fieldErrors?.city && (
                                    <p id="city-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.city}
                                    </p>
                                )}
                            </div>

                            {/* Province */}
                            <div className="space-y-2">
                                <Label htmlFor="province">Province</Label>
                                <Input // Consider using a Select component if preferred
                                    id="province"
                                    name="province"
                                    defaultValue={family.province ?? ''}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.province}
                                    aria-describedby="province-error"
                                />
                                {actionData?.fieldErrors?.province && (
                                    <p id="province-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.province}
                                    </p>
                                )}
                            </div>

                            {/* Postal Code */}
                            <div className="space-y-2">
                                <Label htmlFor="postal_code">Postal Code</Label>
                                <Input
                                    id="postal_code"
                                    name="postal_code"
                                    defaultValue={family.postal_code ?? ''}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.postal_code}
                                    aria-describedby="postal_code-error"
                                />
                                {actionData?.fieldErrors?.postal_code && (
                                    <p id="postal_code-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.postal_code}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="space-y-2">
                            <Label htmlFor="emergency_contact">Emergency Contact</Label>
                            <Input
                                id="emergency_contact"
                                name="emergency_contact"
                                defaultValue={family.emergency_contact ?? ''}
                                aria-invalid={!!actionData?.fieldErrors?.emergency_contact}
                                aria-describedby="emergency_contact-error"
                            />
                            {actionData?.fieldErrors?.emergency_contact && (
                                <p id="emergency_contact-error" className="text-sm text-destructive">
                                    {actionData.fieldErrors.emergency_contact}
                                </p>
                            )}
                        </div>

                        {/* Health Info */}
                        <div className="space-y-2">
                            <Label htmlFor="health_info">Health Info</Label>
                            <Input // Consider Textarea if this can be long
                                id="health_info"
                                name="health_info"
                                defaultValue={family.health_info ?? ''}
                                aria-invalid={!!actionData?.fieldErrors?.health_info}
                                aria-describedby="health_info-error"
                            />
                            {actionData?.fieldErrors?.health_info && (
                                <p id="health_info-error" className="text-sm text-destructive">
                                    {actionData.fieldErrors.health_info}
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Input // Consider Textarea if this can be long
                                id="notes"
                                name="notes"
                                defaultValue={family.notes ?? ''}
                                aria-invalid={!!actionData?.fieldErrors?.notes}
                                aria-describedby="notes-error"
                            />
                            {actionData?.fieldErrors?.notes && (
                                <p id="notes-error" className="text-sm text-destructive">
                                    {actionData.fieldErrors.notes}
                                </p>
                            )}
                        </div>

                        {/* Referral Source */}
                        <div className="space-y-2">
                            <Label htmlFor="referral_source">Referral Source</Label>
                            <Input
                                id="referral_source"
                                name="referral_source"
                                defaultValue={family.referral_source ?? ''}
                                aria-invalid={!!actionData?.fieldErrors?.referral_source}
                                aria-describedby="referral_source-error"
                            />
                            {actionData?.fieldErrors?.referral_source && (
                                <p id="referral_source-error" className="text-sm text-destructive">
                                    {actionData.fieldErrors.referral_source}
                                </p>
                            )}
                        </div>

                        {/* Referral Name */}
                        <div className="space-y-2">
                            <Label htmlFor="referral_name">Referral Name</Label>
                            <Input
                                id="referral_name"
                                name="referral_name"
                                defaultValue={family.referral_name ?? ''}
                                aria-invalid={!!actionData?.fieldErrors?.referral_name}
                                aria-describedby="referral_name-error"
                            />
                            {actionData?.fieldErrors?.referral_name && (
                                <p id="referral_name-error" className="text-sm text-destructive">
                                    {actionData.fieldErrors.referral_name}
                                </p>
                            )}
                        </div>

                        <Separator className="my-4"/>

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" asChild>
                                <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

// You might want a more specific Error Boundary for the edit page later
export {ErrorBoundary} from "./admin.families.$familyId";
