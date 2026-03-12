
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { buildTree } from '../utils/treeHelpers';

export const useOrgData = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: nodes, error } = await supabase
                    .from('organization_nodes')
                    .select('*')
                    .order('role', { ascending: true }); // Order isn't super critical for tree, but consistent

                if (error) {
                    throw error;
                }

                if (nodes && nodes.length > 0) {
                    const tree = buildTree(nodes);
                    setData(tree);
                } else {
                    setData(null); // Empty DB
                }
            } catch (err) {
                console.error("Error fetching organization data:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Setup Subscription for real-time updates (Bonus Feature!)
        const subscription = supabase
            .channel('public:organization_nodes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_nodes' }, (payload) => {
                console.log('Change received!', payload);
                fetchData(); // Simplest: Refetch all to rebuild tree. (Can optimize later)
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    // Function to add a new node (create)
    const addNode = async (newNode) => {
        const { error } = await supabase
            .from('organization_nodes')
            .insert([newNode]);
        if (error) throw error;
        // Refetch happens automatically via subscription or manually if subscription fails
    };

    // Function to update a node (details or parent for drag & drop)
    const updateNode = async (id, updates) => {
        const { error } = await supabase
            .from('organization_nodes')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    };

    return { data, loading, error, addNode, updateNode };
};
