
import { supabase } from '../supabaseClient';

export const orgService = {
    // Fetch all nodes and build the tree
    async getOrgChart() {
        const { data: nodes, error } = await supabase
            .from('organization_nodes')
            .select('*');

        if (error) throw error;
        return nodes;
    },

    // Insert a new node (for Unassigned or directly adding)
    async createNode(nodeData) {
        const { id, children, ...payload } = nodeData;

        const dbPayload = {
            role: payload.role,
            name: payload.name,
            status: payload.status,
            type: payload.type,
            profile: payload.profile,
            tasks: payload.tasks,
            photo_url: payload.photoUrl || payload.photo_url,
            parent_id: payload.parentId || payload.parent_id,
            position: payload.position || 0,
            hierarchy_level: payload.hierarchy_level ?? 3,
            relationship: payload.relationship || 'line'
        };

        const { data, error } = await supabase
            .from('organization_nodes')
            .insert([dbPayload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateNode(id, updates) {
        const dbUpdates = {};
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.profile !== undefined) dbUpdates.profile = updates.profile;
        if (updates.tasks !== undefined) dbUpdates.tasks = updates.tasks;
        if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
        if (updates.photo_url !== undefined) dbUpdates.photo_url = updates.photo_url;
        if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
        if (updates.parent_id !== undefined) dbUpdates.parent_id = updates.parent_id;
        if (updates.position !== undefined) dbUpdates.position = updates.position;
        if (updates.hierarchy_level !== undefined) dbUpdates.hierarchy_level = updates.hierarchy_level;
        if (updates.relationship !== undefined) dbUpdates.relationship = updates.relationship;

        const { data, error } = await supabase
            .from('organization_nodes')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteNode(id) {
        const { error } = await supabase
            .from('organization_nodes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    // =============================================
    // ATTACHMENTS (Profile Documents - PDF/Word)
    // =============================================

    async getAttachments(nodeId) {
        const { data, error } = await supabase
            .from('node_attachments')
            .select('*')
            .eq('node_id', nodeId)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async uploadAttachment(nodeId, file) {
        // 1. Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${nodeId}/${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('profile-documents')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 2. Save metadata to node_attachments table
        const { data: attachment, error: dbError } = await supabase
            .from('node_attachments')
            .insert([{
                node_id: nodeId,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: uploadData.path
            }])
            .select()
            .single();

        if (dbError) throw dbError;
        return attachment;
    },

    async deleteAttachment(attachmentId, storagePath) {
        // 1. Delete from Storage
        const { error: storageError } = await supabase
            .storage
            .from('profile-documents')
            .remove([storagePath]);

        if (storageError) console.error('Storage delete error:', storageError);

        // 2. Delete metadata from DB
        const { error: dbError } = await supabase
            .from('node_attachments')
            .delete()
            .eq('id', attachmentId);

        if (dbError) throw dbError;
        return true;
    },

    getAttachmentUrl(storagePath) {
        const { data } = supabase
            .storage
            .from('profile-documents')
            .getPublicUrl(storagePath);

        return data?.publicUrl;
    },

    // =============================================
    // AVATAR UPLOAD (to Storage instead of base64)
    // =============================================

    async uploadAvatar(nodeId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${nodeId}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true // Overwrite existing avatar
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase
            .storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update the node's photo_url
        const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // Cache bust
        await this.updateNode(nodeId, { photo_url: publicUrl });

        return publicUrl;
    },

    // Seed function (recursive) — updated with new fields
    async seedFromData(rootNode) {
        const { count } = await supabase
            .from('organization_nodes')
            .select('*', { count: 'exact', head: true });

        if (count > 0) return false;

        console.log("Seeding database...");

        const insertNode = async (node, parentId = null) => {
            const payload = {
                role: node.role,
                name: node.name,
                status: node.status,
                type: node.type,
                profile: node.profile,
                tasks: node.tasks,
                photo_url: node.photoUrl,
                parent_id: parentId,
                position: node.position || 0,
                hierarchy_level: node.hierarchy_level ?? 3,
                relationship: node.relationship || 'line'
            };

            const { data: newNode, error } = await supabase
                .from('organization_nodes')
                .insert([payload])
                .select()
                .single();

            if (error) {
                console.error("Error seeding node:", node.role, error);
                return;
            }

            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    await insertNode(child, newNode.id);
                }
            }
        };

        await insertNode(rootNode);
        return true;
    }
};
