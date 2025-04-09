import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";

export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer} = getSupabaseServerClient(request);

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json({waivers: [], userSignedWaivers: [], isAuthenticated: false});
    }

    // Get all available waivers
    const {data: waivers, error: waiversError} = await supabaseServer
        .from('waivers')
        .select('*')
        .order('required', {ascending: false});

    // Get waivers signed by the user
    const {data: userSignedWaivers} = await supabaseServer
        .from('waiver_signatures')
        .select('waiver_id, signed_at')
        .eq('user_id', user.id);

    // Basic error logging if waivers fetch fails
    if (waiversError) {
        console.error("Error fetching waivers:", waiversError);
        // Depending on desired UX, you might want to throw an error or return an error state
    }

    return json({
        waivers: waivers || [],
        userSignedWaivers: userSignedWaivers || [],
        isAuthenticated: true
    });
}

export default function WaiversIndex() {
    const {waivers, userSignedWaivers, isAuthenticated} = useLoaderData<typeof loader>();

    // Create a map of waiver_id to signed status for quick lookup
    const signedWaiverMap = new Map();
    userSignedWaivers.forEach(signature => {
        signedWaiverMap.set(signature.waiver_id, signature.signed_at);
    });

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-6">Waivers & Agreements</h1>

            <p className="mb-6">
                The following waivers and agreements are required for participation in our karate classes.
                Please review and sign each document.
            </p>
            <div className="space-y-4">
                {!isAuthenticated ? (
                    <p>Please <Link to="/login?redirectTo=/waivers" className="text-blue-600 hover:underline">log
                        in</Link> to view and sign waivers.</p>
                ) : waivers.length === 0 ? (
                    <p>No waivers are currently available.</p>
                ) : (
                    waivers.map(waiver => {
                        const isSigned = signedWaiverMap.has(waiver.id);
                        const signedDate = isSigned ? new Date(signedWaiverMap.get(waiver.id)).toLocaleDateString() : null;

                        return (
                            <div key={waiver.id} className="border rounded-lg p-4">
                                {/* Stack vertically by default, row on sm screens and up */}
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start sm:space-x-4">
                                    {/* Add bottom margin only on small screens */}
                                    <div className="mb-4 sm:mb-0">
                                        <h2 className="text-xl font-semibold">{waiver.title}</h2>
                                        <p className="text-gray-600 dark:text-gray-300">{waiver.description}</p>

                                        {/* Required badge moved to the button row */}

                                        {isSigned && (
                                            <div className="mt-2 text-sm text-green-600">
                                                Signed on {signedDate}
                                            </div>
                                        )}
                                    </div>

                                    {/* Use justify-between to push Sign button right */}
                                    <div className="flex flex-row items-baseline justify-between">
                                        {/* Group Badge and View link */}
                                        <div className="flex items-baseline space-x-2">
                                            {/* Required badge */}
                                            {waiver.required && (
                                                <span
                                                    className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded"> {/* Removed mr-2 */}
                                                    Required
                                                </span>
                                            )}
                                            <Link
                                                to={`/waivers/${waiver.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                View
                                            </Link>
                                        </div>

                                        {/* Sign Now button (remains direct child for justify-between) */}
                                        {!isSigned && (
                                            <Link
                                                to={`/waivers/${waiver.id}/sign`}
                                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                Sign Now
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
